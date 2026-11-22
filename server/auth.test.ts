import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { deletedCell, hashSetupCode, parseAccountState, pendingCell } from './accountState';
import { activate, type AuthDeps, bearerToken, login, me, MSG } from './auth';
import { verifySession } from './session';
import type { UserRow, UserStore } from './users';

const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);
const CODE = 'ABCD-EFGH-JKMN';

/** In-memory stand-in for the Google Sheet. */
function memoryStore(rows: UserRow[] = []): UserStore & { rows: UserRow[] } {
  const find = (id: string) => rows.find((r) => r.user_id === id);
  return {
    rows,
    async findByUsername(u) {
      return rows.find((r) => r.username === u) ?? null;
    },
    async findById(id) {
      return find(id) ?? null;
    },
    async create(user) {
      rows.push(user);
    },
    async touchLogin(id, at) {
      const r = find(id);
      if (r) r.last_login = at;
    },
    async setPasswordHash(id, value) {
      const r = find(id);
      if (r) r.password_hash = value;
    },
  };
}

const pending = (expiresAt = NOW + 1000, attempts = 0): UserRow => ({
  user_id: 'u1',
  username: 'ana',
  password_hash: pendingCell(hashSetupCode(CODE, SECRET), expiresAt, attempts),
  created_at: '2026-11-22T00:00:00.000Z',
  last_login: '',
});

function deps(rows: UserRow[] = [pending()]): AuthDeps & { users: ReturnType<typeof memoryStore> } {
  return {
    users: memoryStore(rows),
    secret: SECRET,
    now: () => NOW,
    newId: () => 'new-id',
    hash: (p) => bcrypt.hash(p, 4), // low cost keeps tests fast
    compare: (p, h) => bcrypt.compare(p, h),
  };
}

describe('activate (one-time code)', () => {
  it('sets the password, signs in and burns the code', async () => {
    const d = deps();
    const res = await activate(d, { username: ' Ana ', code: 'abcd efgh jkmn', password: 'secreta123' });
    expect(res.status).toBe(200);
    const body = res.body as { token: string; user: unknown };
    expect(body.user).toEqual({ user_id: 'u1', username: 'ana' });
    expect(verifySession(body.token, SECRET, NOW)?.sub).toBe('u1');
    const row = d.users.rows[0];
    expect(parseAccountState(row.password_hash).kind).toBe('active');
    expect(await bcrypt.compare('secreta123', row.password_hash)).toBe(true);
    expect(row.last_login).toBe('2026-11-22T12:00:00.000Z');
    // the same code can't be used twice
    expect((await activate(d, { username: 'ana', code: CODE, password: 'otra12345' })).status).toBe(401);
  });

  it('checks the password before spending a try', async () => {
    const d = deps();
    expect((await activate(d, { username: 'ana', code: 'WRONG', password: 'corta' })).status).toBe(400);
    expect(parseAccountState(d.users.rows[0].password_hash)).toMatchObject({ attempts: 0 });
  });

  it('counts wrong codes and burns the code on the 5th', async () => {
    const d = deps([pending(NOW + 1000, 3)]);
    expect(await activate(d, { username: 'ana', code: 'ZZZZ-ZZZZ-ZZZZ', password: 'secreta123' })).toEqual({
      status: 401,
      body: { error: MSG.badCode },
    });
    expect(parseAccountState(d.users.rows[0].password_hash)).toMatchObject({ attempts: 4 });
    await activate(d, { username: 'ana', code: 'ZZZZ-ZZZZ-ZZZZ', password: 'secreta123' });
    // now even the right code fails
    expect((await activate(d, { username: 'ana', code: CODE, password: 'secreta123' })).status).toBe(401);
  });

  it('rejects expired codes, unknown and deleted users with the same message', async () => {
    expect((await activate(deps([pending(NOW - 1)]), { username: 'ana', code: CODE, password: 'secreta123' })).body).toEqual({
      error: MSG.badCode,
    });
    expect((await activate(deps([]), { username: 'ana', code: CODE, password: 'secreta123' })).status).toBe(401);
    const del = { ...pending(), password_hash: deletedCell('x') };
    expect((await activate(deps([del]), { username: 'ana', code: CODE, password: 'secreta123' })).status).toBe(401);
  });
});

describe('login and me', () => {
  async function activeDeps() {
    const d = deps();
    const { token } = (await activate(d, { username: 'ana', code: CODE, password: 'secreta123' })).body as { token: string };
    return { d, token };
  }

  it('logs in an active user and updates last_login', async () => {
    const { d } = await activeDeps();
    d.users.rows[0].last_login = 'old';
    const res = await login(d, { username: 'ANA', password: 'secreta123' });
    expect(res.status).toBe(200);
    expect(d.users.rows[0].last_login).toBe('2026-11-22T12:00:00.000Z');
  });

  it('gives the same error for wrong passwords, unknown, pending and deleted users', async () => {
    const { d } = await activeDeps();
    const wrong = await login(d, { username: 'ana', password: 'incorrecta' });
    expect(wrong).toEqual({ status: 401, body: { error: MSG.wrongCredentials } });
    expect(await login(d, { username: 'nadie', password: 'secreta123' })).toEqual(wrong);
    expect(await login(deps(), { username: 'ana', password: CODE })).toEqual(wrong);
    d.users.rows[0].password_hash = deletedCell('x');
    expect(await login(d, { username: 'ana', password: 'secreta123' })).toEqual(wrong);
  });

  it('me: valid until the account is reset or deleted', async () => {
    const { d, token } = await activeDeps();
    expect(await me(d, `Bearer ${token}`)).toEqual({ status: 200, body: { user: { user_id: 'u1', username: 'ana' } } });
    // admin resets (new code) and the person activates again: old devices are signed out
    d.users.rows[0].password_hash = pendingCell(hashSetupCode(CODE, SECRET), NOW + 1000, 0);
    expect((await me(d, `Bearer ${token}`)).status).toBe(401);
    await activate(d, { username: 'ana', code: CODE, password: 'nueva12345' });
    expect((await me(d, `Bearer ${token}`)).status).toBe(401);
    expect((await me(d, null)).status).toBe(401);
  });

  it('parses bearer headers', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer  abc ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
  });
});
