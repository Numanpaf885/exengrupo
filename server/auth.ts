/**
 * Auth handlers (register, login, me) as plain functions with injected
 * dependencies, so they can be unit-tested without Google or Vercel.
 */
import { normalizeUsername, passwordError, usernameError } from '../src/lib/auth/validation';
import { signSession, verifySession } from './session';
import type { UserStore } from './users';

export interface AuthDeps {
  users: UserStore;
  secret: string;
  now: () => number;
  newId: () => string;
  hash: (password: string) => Promise<string>;
  compare: (password: string, hash: string) => Promise<boolean>;
}

export interface Result {
  status: number;
  body: unknown;
}

export const MSG = {
  badRequest: 'Datos no válidos.',
  taken: 'Ese usuario ya existe.',
  wrongCredentials: 'Usuario o contraseña incorrectos.',
  noSession: 'Tu sesión ha caducado. Entra de nuevo.',
} as const;

const fail = (status: number, error: string): Result => ({ status, body: { error } });

function credentials(body: unknown): { username: string; password: string } | null {
  if (!body || typeof body !== 'object') return null;
  const { username, password } = body as Record<string, unknown>;
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  return { username, password };
}

const session = (deps: AuthDeps, userId: string, username: string) => ({
  token: signSession({ userId, username }, deps.secret, deps.now()),
  user: { user_id: userId, username },
});

export async function register(deps: AuthDeps, body: unknown): Promise<Result> {
  const c = credentials(body);
  if (!c) return fail(400, MSG.badRequest);
  const invalid = usernameError(c.username) ?? passwordError(c.password);
  if (invalid) return fail(400, invalid);

  const username = normalizeUsername(c.username);
  if (await deps.users.findByUsername(username)) return fail(409, MSG.taken);

  const at = new Date(deps.now()).toISOString();
  const userId = deps.newId();
  await deps.users.create({
    user_id: userId,
    username,
    password_hash: await deps.hash(c.password),
    created_at: at,
    last_login: at,
  });
  return { status: 201, body: session(deps, userId, username) };
}

// Compared against when the user does not exist, so both paths take similar time.
const DUMMY_HASH = '$2b$10$XUIdwntwoSjkMBPHIeunBObkk37pgOT.IX/KEqXtkx1sHB.a5vYym';

export async function login(deps: AuthDeps, body: unknown): Promise<Result> {
  const c = credentials(body);
  if (!c) return fail(400, MSG.badRequest);
  const user = await deps.users.findByUsername(normalizeUsername(c.username));
  const ok = await deps.compare(c.password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) return fail(401, MSG.wrongCredentials);

  await deps.users.touchLogin(user.user_id, new Date(deps.now()).toISOString());
  return { status: 200, body: session(deps, user.user_id, user.username) };
}

export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return m ? m[1].trim() : null;
}

export async function me(deps: AuthDeps, authorization: string | null): Promise<Result> {
  const payload = verifySession(bearerToken(authorization) ?? '', deps.secret, deps.now());
  if (!payload) return fail(401, MSG.noSession);
  const user = await deps.users.findById(payload.sub);
  if (!user) return fail(401, MSG.noSession);
  return { status: 200, body: { user: { user_id: user.user_id, username: user.username } } };
}
