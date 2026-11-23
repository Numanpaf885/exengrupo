import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSetupCode, normalizeSetupCode, parseAccountState } from './accountState';
import {
  ADMIN_MSG,
  type AdminDeps,
  adminLogin,
  createUser,
  deleteUser,
  getKeys,
  listUsers,
  requireAdmin,
  resetAdminRateLimit,
  resetUser,
  saveKey,
  testKey,
} from './admin';
import { listMySpaces, createSpace, joinSpace } from './spaces';
import { bearer, TEST_NOW, TEST_SECRET, testDeps } from './testing';
import { adminPath, matchAdminRoute } from './router';
import { decryptSecret } from './secretbox';

function adminDeps(over: Partial<AdminDeps> = {}) {
  const base = testDeps([{ id: 'boss', name: 'boss' }]);
  const settings = base.settings; // boss may create spaces
  const testKeyFn = vi.fn(async () => ({ ok: true, message: 'Clave válida.' }));
  const deps: AdminDeps = {
    ...base,
    adminPassword: 'correct horse battery',
    settings,
    env: { GEMINI_API_KEY: 'gemini-env-key-9999' },
    testKey: testKeyFn,
    ...over,
  };
  return { deps, base, settings, testKeyFn };
}

async function token(deps: AdminDeps) {
  const res = await adminLogin(deps, { password: 'correct horse battery' }, '1.2.3.4');
  return `Bearer ${(res.body as { token: string }).token}`;
}

beforeEach(() => resetAdminRateLimit());

describe('admin sign-in', () => {
  it('signs in with ADMIN_PASSWORD and the token works for 12 hours', async () => {
    const { deps } = adminDeps();
    const auth = await token(deps);
    expect(requireAdmin(deps, auth)).toBeNull();
    expect(requireAdmin({ ...deps, now: () => TEST_NOW + 12 * 3600_000 }, auth)?.status).toBe(401);
  });

  it('refuses wrong passwords, user tokens and a missing ADMIN_PASSWORD', async () => {
    const { deps } = adminDeps();
    expect(await adminLogin(deps, { password: 'nope' }, 'ip')).toEqual({ status: 401, body: { error: ADMIN_MSG.wrongPassword } });
    expect(requireAdmin(deps, bearer('boss'))?.status).toBe(401);
    expect(requireAdmin(deps, null)?.status).toBe(401);
    const unset = adminDeps({ adminPassword: undefined }).deps;
    expect((await adminLogin(unset, { password: 'x' }, 'ip')).status).toBe(503);
  });

  it('locks an IP after 8 wrong tries', async () => {
    const { deps } = adminDeps();
    for (let i = 0; i < 8; i++) await adminLogin(deps, { password: 'bad' }, 'ip');
    expect((await adminLogin(deps, { password: 'correct horse battery' }, 'ip')).status).toBe(429);
    expect((await adminLogin(deps, { password: 'correct horse battery' }, 'other-ip')).status).toBe(200);
  });
});

describe('admin users', () => {
  it('creates a user with a one-time code that is stored only as a hash', async () => {
    const { deps, base } = adminDeps();
    const res = await createUser(deps, { username: ' Luis ' });
    expect(res.status).toBe(201);
    const body = res.body as { user: { username: string }; code: string; expires_at: string };
    expect(body.user.username).toBe('luis');
    expect(body.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(body.expires_at).toBe(new Date(TEST_NOW + 72 * 3600_000).toISOString());
    const row = base.users.rows.find((u) => u.username === 'luis')!;
    expect(row.password_hash).not.toContain(normalizeSetupCode(body.code));
    expect(parseAccountState(row.password_hash)).toMatchObject({ kind: 'pending', hash: hashSetupCode(body.code, TEST_SECRET), attempts: 0 });
    expect((await createUser(deps, { username: 'luis' })).status).toBe(409);
    expect((await createUser(deps, { username: 'x' })).status).toBe(400);
  });

  it('lists users with their status, never codes or hashes', async () => {
    const { deps } = adminDeps();
    await createUser(deps, { username: 'luis' });
    const users = ((await listUsers(deps)).body as { users: Array<Record<string, unknown>> }).users;
    expect(users.map((u) => [u.username, u.status])).toEqual([
      ['boss', 'active'],
      ['luis', 'pending'],
    ]);
    expect(JSON.stringify(users)).not.toMatch(/setup:|password_hash/);
  });

  it('a new code signs the person out everywhere', async () => {
    const { deps } = adminDeps();
    await createSpace(deps, bearer('boss'), { name: 'Bio' });
    expect((await listMySpaces(deps, bearer('boss'))).status).toBe(200);
    const res = await resetUser(deps, 'boss');
    expect(res.status).toBe(200);
    expect((await listMySpaces(deps, bearer('boss'))).status).toBe(401);
    expect((await resetUser(deps, 'nobody')).status).toBe(404);
  });

  it('delete: account stops working, leaves every space, and the name can be reused', async () => {
    const { deps, base } = adminDeps();
    const created = (await createUser(deps, { username: 'eva' })).body as { user: { user_id: string } };
    base.users.rows.find((u) => u.username === 'eva')!.password_hash = '$2b$10$active';
    const space = ((await createSpace(deps, bearer('boss'), { name: 'Bio' })).body as { space: { join_code: string } }).space;
    await joinSpace(deps, bearer(created.user.user_id), { code: space.join_code });

    expect((await deleteUser(deps, created.user.user_id)).status).toBe(200);
    expect(base.members.rows.find((m) => m.user_id === created.user.user_id)?.removed).toBe('TRUE');
    expect((await listMySpaces(deps, bearer(created.user.user_id))).status).toBe(401);
    expect(((await listUsers(deps)).body as { users: unknown[] }).users).toHaveLength(1);

    const again = await createUser(deps, { username: 'eva' });
    expect(again.status).toBe(201);
    expect(base.users.rows.filter((u) => u.username === 'eva')).toHaveLength(1); // row reused
    expect((again.body as { user: { user_id: string } }).user.user_id).not.toBe(created.user.user_id);
  });
});

describe('admin AI keys', () => {
  it('shows the order and key hints, saves keys encrypted and models in plain text', async () => {
    const { deps, settings } = adminDeps();
    const before = (await getKeys(deps)).body as { order: string[]; providers: Array<Record<string, unknown>> };
    expect(before.order).toEqual(['claude', 'gemini', 'groq', 'openrouter']);
    expect(before.providers[1]).toMatchObject({ id: 'gemini', key_set: true, key_hint: '…9999', key_source: 'vercel' });

    await saveKey(deps, 'claude', { key: ' sk-ant-secret-abcd ', model: 'claude-opus-5-5' });
    expect(settings.values.claude_api_key).not.toContain('sk-ant');
    expect(decryptSecret(settings.values.claude_api_key, TEST_SECRET)).toBe('sk-ant-secret-abcd');
    expect(settings.values.claude_model).toBe('claude-opus-5-5');
    const after = (await getKeys(deps)).body as { providers: Array<Record<string, unknown>> };
    expect(after.providers[0]).toMatchObject({ key_set: true, key_hint: '…abcd', key_source: 'admin' });

    await saveKey(deps, 'claude', { key: '' });
    expect(((await getKeys(deps)).body as { providers: Array<Record<string, unknown>> }).providers[0]).toMatchObject({ key_set: false });
    expect((await saveKey(deps, 'nope', { key: 'x' })).status).toBe(404);
    expect((await saveKey(deps, 'groq', { model: 'has space' })).status).toBe(400);
  });

  it('tests the typed key, or the current one', async () => {
    const { deps, testKeyFn } = adminDeps();
    await testKey(deps, 'groq', { key: 'typed-key', model: 'm' });
    expect(testKeyFn).toHaveBeenLastCalledWith('groq', 'typed-key', 'm');
    await testKey(deps, 'gemini', {});
    expect(testKeyFn).toHaveBeenLastCalledWith('gemini', 'gemini-env-key-9999', 'gemini-3.8-flash');
    expect(await testKey(deps, 'claude', {})).toEqual({ status: 400, body: { error: ADMIN_MSG.noKey } });
  });
});

describe('admin router', () => {
  const seg = (u: string) => adminPath(new URL(u, 'https://x.app'));
  it('matches every route', () => {
    expect(seg('/api/admin?__path=users/u1/reset')).toEqual(['users', 'u1', 'reset']);
    expect(matchAdminRoute('POST', ['login'])).toEqual({ name: 'login' });
    expect(matchAdminRoute('GET', ['users'])).toEqual({ name: 'listUsers' });
    expect(matchAdminRoute('POST', ['users'])).toEqual({ name: 'createUser' });
    expect(matchAdminRoute('POST', ['users', 'u1', 'reset'])).toEqual({ name: 'resetUser', userId: 'u1' });
    expect(matchAdminRoute('DELETE', ['users', 'u1'])).toEqual({ name: 'deleteUser', userId: 'u1' });
    expect(matchAdminRoute('GET', ['keys'])).toEqual({ name: 'getKeys' });
    expect(matchAdminRoute('PUT', ['keys', 'groq'])).toEqual({ name: 'saveKey', provider: 'groq' });
    expect(matchAdminRoute('POST', ['keys', 'groq', 'test'])).toEqual({ name: 'testKey', provider: 'groq' });
    expect(matchAdminRoute('GET', ['login'])).toEqual({ name: 'methodNotAllowed' });
    expect(matchAdminRoute('GET', ['nope'])).toEqual({ name: 'notFound' });
  });
});
