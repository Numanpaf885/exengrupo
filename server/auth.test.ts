import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { type AuthDeps, bearerToken, login, me, MSG, register } from './auth';
import { verifySession } from './session';
import type { UserRow, UserStore } from './users';

/** In-memory stand-in for the Google Sheet. */
function memoryStore(): UserStore & { rows: UserRow[] } {
  const rows: UserRow[] = [];
  return {
    rows,
    async findByUsername(u) {
      return rows.find((r) => r.username === u) ?? null;
    },
    async findById(id) {
      return rows.find((r) => r.user_id === id) ?? null;
    },
    async create(user) {
      rows.push(user);
    },
    async touchLogin(id, at) {
      const r = rows.find((x) => x.user_id === id);
      if (r) r.last_login = at;
    },
  };
}

const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);

function deps(users = memoryStore()): AuthDeps & { users: ReturnType<typeof memoryStore> } {
  let n = 0;
  return {
    users,
    secret: 'test-secret',
    now: () => NOW,
    newId: () => `id-${++n}`,
    hash: (p) => bcrypt.hash(p, 4), // low cost keeps tests fast
    compare: (p, h) => bcrypt.compare(p, h),
  };
}

describe('register', () => {
  it('creates a user with a bcrypt hash and returns a session', async () => {
    const d = deps();
    const res = await register(d, { username: ' Ana ', password: 'secreta123' });
    expect(res.status).toBe(201);
    const body = res.body as { token: string; user: { user_id: string; username: string } };
    expect(body.user).toEqual({ user_id: 'id-1', username: 'ana' });
    expect(verifySession(body.token, 'test-secret', NOW)?.sub).toBe('id-1');

    const row = d.users.rows[0];
    expect(row.username).toBe('ana');
    expect(row.password_hash).not.toContain('secreta123');
    expect(await bcrypt.compare('secreta123', row.password_hash)).toBe(true);
    expect(row.created_at).toBe('2026-11-20T12:00:00.000Z');
    expect(row.last_login).toBe('2026-11-20T12:00:00.000Z');
  });

  it('rejects a taken username case-insensitively', async () => {
    const d = deps();
    await register(d, { username: 'ana', password: 'secreta123' });
    expect(await register(d, { username: 'ANA', password: 'otra12345' })).toEqual({
      status: 409,
      body: { error: MSG.taken },
    });
  });

  it('validates input', async () => {
    const d = deps();
    expect((await register(d, null)).status).toBe(400);
    expect((await register(d, { username: 'a', password: 'secreta123' })).status).toBe(400);
    expect(((await register(d, { username: 'ana', password: 'corta' })).body as { error: string }).error).toMatch(
      /al menos 8/,
    );
    expect(d.users.rows).toHaveLength(0);
  });
});

describe('login', () => {
  it('logs in with the right password and updates last_login', async () => {
    const d = deps();
    await register(d, { username: 'ana', password: 'secreta123' });
    d.users.rows[0].last_login = 'old';
    const res = await login(d, { username: 'Ana', password: 'secreta123' });
    expect(res.status).toBe(200);
    expect((res.body as { user: unknown }).user).toEqual({ user_id: 'id-1', username: 'ana' });
    expect(d.users.rows[0].last_login).toBe('2026-11-20T12:00:00.000Z');
  });

  it('gives the same error for a wrong password and an unknown user', async () => {
    const d = deps();
    await register(d, { username: 'ana', password: 'secreta123' });
    const wrong = await login(d, { username: 'ana', password: 'incorrecta' });
    const unknown = await login(d, { username: 'nadie', password: 'secreta123' });
    expect(wrong).toEqual({ status: 401, body: { error: MSG.wrongCredentials } });
    expect(unknown).toEqual(wrong);
  });
});

describe('me', () => {
  it('returns the user for a valid bearer token', async () => {
    const d = deps();
    const { token } = (await register(d, { username: 'ana', password: 'secreta123' })).body as { token: string };
    expect(await me(d, `Bearer ${token}`)).toEqual({
      status: 200,
      body: { user: { user_id: 'id-1', username: 'ana' } },
    });
  });

  it('rejects missing, invalid or orphaned tokens', async () => {
    const d = deps();
    expect((await me(d, null)).status).toBe(401);
    expect((await me(d, 'Bearer nope')).status).toBe(401);
    const { token } = (await register(d, { username: 'ana', password: 'secreta123' })).body as { token: string };
    d.users.rows.length = 0;
    expect(await me(d, `Bearer ${token}`)).toEqual({ status: 401, body: { error: MSG.noSession } });
  });

  it('parses bearer headers', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer  abc ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
  });
});
