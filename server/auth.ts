/**
 * Accounts are invite-only: the admin creates a user and gets a one-time code
 * (server/admin.ts). The person activates it here with their username, the
 * code and a new password. Handlers take injected deps so tests need no Google.
 */
import { normalizeUsername, passwordError } from '../src/lib/auth/validation';
import {
  codeUsable,
  hashSetupCode,
  parseAccountState,
  pendingCell,
  sameHash,
  SETUP_MAX_ATTEMPTS,
} from './accountState';
import { passwordVersion, signSession, verifySession } from './session';
import type { UserRow, UserStore } from './users';

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
  wrongCredentials: 'Usuario o contraseña incorrectos.',
  noSession: 'Tu sesión ha caducado. Entra de nuevo.',
  badCode: 'Código no válido o caducado. Pide uno nuevo al administrador.',
} as const;

const fail = (status: number, error: string): Result => ({ status, body: { error } });

function fields(body: unknown, names: string[]): Record<string, string> | null {
  if (!body || typeof body !== 'object') return null;
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = (body as Record<string, unknown>)[n];
    if (typeof v !== 'string') return null;
    out[n] = v;
  }
  return out;
}

const session = (deps: AuthDeps, user: UserRow) => ({
  token: signSession(
    { userId: user.user_id, username: user.username, passwordHash: user.password_hash },
    deps.secret,
    deps.now(),
  ),
  user: { user_id: user.user_id, username: user.username },
});

/** POST /api/auth/activate { username, code, password } — first sign-in with a one-time code. */
export async function activate(deps: AuthDeps, body: unknown): Promise<Result> {
  const f = fields(body, ['username', 'code', 'password']);
  if (!f) return fail(400, MSG.badRequest);
  // Password rules first, so a weak password never spends one of the code's tries.
  const weak = passwordError(f.password);
  if (weak) return fail(400, weak);

  const now = deps.now();
  const user = await deps.users.findByUsername(normalizeUsername(f.username));
  const state = user ? parseAccountState(user.password_hash) : null;
  if (!user || !state || state.kind !== 'pending' || !codeUsable(state, now)) return fail(401, MSG.badCode);

  if (!sameHash(hashSetupCode(f.code, deps.secret), state.hash)) {
    // A wrong code spends a try; the last try burns the code for good.
    const attempts = state.attempts + 1;
    await deps.users.setPasswordHash(user.user_id, pendingCell(attempts >= SETUP_MAX_ATTEMPTS ? '' : state.hash, state.expiresAt, attempts));
    return fail(401, MSG.badCode);
  }

  const passwordHash = await deps.hash(f.password);
  await deps.users.setPasswordHash(user.user_id, passwordHash);
  await deps.users.touchLogin(user.user_id, new Date(now).toISOString());
  return { status: 200, body: session(deps, { ...user, password_hash: passwordHash }) };
}

// Compared against when the user does not exist or isn't active, so all paths take similar time.
const DUMMY_HASH = '$2b$10$XUIdwntwoSjkMBPHIeunBObkk37pgOT.IX/KEqXtkx1sHB.a5vYym';

export async function login(deps: AuthDeps, body: unknown): Promise<Result> {
  const f = fields(body, ['username', 'password']);
  if (!f) return fail(400, MSG.badRequest);
  const user = await deps.users.findByUsername(normalizeUsername(f.username));
  const active = !!user && parseAccountState(user.password_hash).kind === 'active';
  const ok = await deps.compare(f.password, active && user ? user.password_hash : DUMMY_HASH);
  if (!user || !active || !ok) return fail(401, MSG.wrongCredentials);

  await deps.users.touchLogin(user.user_id, new Date(deps.now()).toISOString());
  return { status: 200, body: session(deps, user) };
}

export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? '');
  return m ? m[1].trim() : null;
}

/** The token's user if it is still active and its password hasn't been reset since. */
export function sessionUserValid(user: UserRow | null, pv: string | undefined): user is UserRow {
  if (!user || parseAccountState(user.password_hash).kind !== 'active') return false;
  return pv === undefined || pv === passwordVersion(user.password_hash);
}

export async function me(deps: AuthDeps, authorization: string | null): Promise<Result> {
  const payload = verifySession(bearerToken(authorization) ?? '', deps.secret, deps.now());
  if (!payload) return fail(401, MSG.noSession);
  const user = await deps.users.findById(payload.sub);
  if (!sessionUserValid(user, payload.pv)) return fail(401, MSG.noSession);
  return { status: 200, body: { user: { user_id: user.user_id, username: user.username } } };
}
