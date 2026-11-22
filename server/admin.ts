/**
 * Admin panel API. Sign-in with ADMIN_PASSWORD (Vercel env) → a 12-hour admin
 * token ("a1.…", separate from user tokens). The admin creates users and gets
 * a one-time code to hand over (shown once, stored only as a keyed hash),
 * gives a new code (which also signs that person out everywhere), deletes
 * users, and manages the AI keys/models (Sheet tab "ajustes", encrypted).
 */
import { normalizeUsername, usernameError } from '../src/lib/auth/validation';
import {
  deletedCell,
  formatSetupCode,
  generateSetupCode,
  hashSetupCode,
  parseAccountState,
  pendingCell,
  SETUP_CODE_TTL_MS,
} from './accountState';
import { bearerToken, type Result } from './auth';
import type { DataDeps } from './context';
import { fail } from './context';
import {
  isProviderId,
  type KeyTest,
  type ProviderId,
  providerViews,
  resolveProviders,
  settingKey,
  settingModel,
} from './ai/config';
import { encryptSecret } from './secretbox';
import { signToken, verifyToken } from './session';
import type { SettingsStore } from './settings';
import { isTrue, TRUE } from './table';

export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export interface AdminDeps extends DataDeps {
  adminPassword: string | undefined;
  settings: SettingsStore;
  env: Record<string, string | undefined>;
  testKey: (id: ProviderId, key: string, model: string) => Promise<KeyTest>;
}

export const ADMIN_MSG = {
  notConfigured: 'Falta ADMIN_PASSWORD en Vercel. Añádela y vuelve a desplegar.',
  wrongPassword: 'Contraseña incorrecta.',
  tooMany: 'Demasiados intentos. Espera 15 minutos.',
  noSession: 'Tu sesión de administración ha caducado. Entra de nuevo.',
  exists: 'Ese usuario ya existe.',
  notFound: 'Ese usuario no existe.',
  badProvider: 'Proveedor desconocido.',
  noKey: 'No hay ninguna clave para probar.',
} as const;

// ---- sign-in ----------------------------------------------------------------

/** Failed admin sign-ins per IP, per server instance (a speed bump, not a vault). */
const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60 * 1000;

export function resetAdminRateLimit(): void {
  failures.clear();
}

export async function adminLogin(deps: AdminDeps, body: unknown, ip: string): Promise<Result> {
  if (!deps.adminPassword) return fail(503, ADMIN_MSG.notConfigured);
  const now = deps.now();
  const f = failures.get(ip);
  if (f && f.count >= MAX_FAILURES && f.until > now) return fail(429, ADMIN_MSG.tooMany);
  const password = body && typeof body === 'object' ? (body as Record<string, unknown>).password : null;
  // Compare HMACs so length and content don't leak through timing.
  const given = hashSetupCode(typeof password === 'string' ? password : '', `admin:${deps.secret}`);
  const expected = hashSetupCode(deps.adminPassword, `admin:${deps.secret}`);
  if (typeof password !== 'string' || given !== expected) {
    const next = f && f.until > now ? f.count + 1 : 1;
    failures.set(ip, { count: next, until: now + LOCK_MS });
    return fail(401, ADMIN_MSG.wrongPassword);
  }
  failures.delete(ip);
  return { status: 200, body: { token: signToken('a1', { role: 'admin', exp: now + ADMIN_TTL_MS }, deps.secret) } };
}

export function requireAdmin(deps: AdminDeps, authorization: string | null): Result | null {
  if (!deps.adminPassword) return fail(503, ADMIN_MSG.notConfigured);
  const p = verifyToken(bearerToken(authorization) ?? '', 'a1', deps.secret);
  if (!p || p.role !== 'admin' || typeof p.exp !== 'number' || p.exp <= deps.now()) return fail(401, ADMIN_MSG.noSession);
  return null;
}

// ---- users -------------------------------------------------------------------

export interface AdminUserView {
  user_id: string;
  username: string;
  status: 'active' | 'pending' | 'expired';
  code_expires_at: string;
  created_at: string;
  last_login: string;
  spaces: number;
}

export async function listUsers(deps: AdminDeps): Promise<Result> {
  const [users, members] = await Promise.all([deps.users.list(), deps.members.list()]);
  const now = deps.now();
  const list: AdminUserView[] = [];
  for (const { value: u } of users) {
    const s = parseAccountState(u.password_hash);
    if (s.kind === 'deleted') continue;
    const usable = s.kind === 'pending' && !!s.hash && s.attempts < 5 && s.expiresAt > now;
    list.push({
      user_id: u.user_id,
      username: u.username,
      status: s.kind === 'active' ? 'active' : usable ? 'pending' : 'expired',
      code_expires_at: s.kind === 'pending' && usable ? new Date(s.expiresAt).toISOString() : '',
      created_at: u.created_at,
      last_login: u.last_login,
      spaces: members.filter((m) => m.value.user_id === u.user_id && !isTrue(m.value.removed)).length,
    });
  }
  list.sort((a, b) => a.username.localeCompare(b.username));
  return { status: 200, body: { users: list } };
}

function newCode(deps: AdminDeps) {
  const code = generateSetupCode(deps.randomIndex);
  const expiresAt = deps.now() + SETUP_CODE_TTL_MS;
  return { code, expiresAt, cell: pendingCell(hashSetupCode(code, deps.secret), expiresAt, 0) };
}

/** The plain code exists only in this response. */
export async function createUser(deps: AdminDeps, body: unknown): Promise<Result> {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).username : null;
  if (typeof raw !== 'string') return fail(400, 'Datos no válidos.');
  const invalid = usernameError(raw);
  if (invalid) return fail(400, invalid);
  const username = normalizeUsername(raw);

  const users = await deps.users.list();
  const existing = users.find((u) => u.value.username === username);
  if (existing && parseAccountState(existing.value.password_hash).kind !== 'deleted') return fail(409, ADMIN_MSG.exists);

  const { code, expiresAt, cell } = newCode(deps);
  const at = new Date(deps.now()).toISOString();
  const userId = deps.newId();
  const row = { user_id: userId, username, password_hash: cell, created_at: at, last_login: '' };
  // A deleted account's row is reused (new user_id, so nothing old carries over).
  if (existing) await deps.users.update(existing.rowNumber, row);
  else await deps.users.append(row);
  return {
    status: 201,
    body: { user: { user_id: userId, username }, code: formatSetupCode(code), expires_at: new Date(expiresAt).toISOString() },
  };
}

/** New one-time code: the old password stops working and every device is signed out. */
export async function resetUser(deps: AdminDeps, userId: string): Promise<Result> {
  const users = await deps.users.list();
  const row = users.find((u) => u.value.user_id === userId);
  if (!row || parseAccountState(row.value.password_hash).kind === 'deleted') return fail(404, ADMIN_MSG.notFound);
  const { code, expiresAt, cell } = newCode(deps);
  await deps.users.update(row.rowNumber, { password_hash: cell });
  return {
    status: 200,
    body: { user: { user_id: userId, username: row.value.username }, code: formatSetupCode(code), expires_at: new Date(expiresAt).toISOString() },
  };
}

/** Deletes the account (it can no longer sign in) and removes it from every space. */
export async function deleteUser(deps: AdminDeps, userId: string): Promise<Result> {
  const users = await deps.users.list();
  const row = users.find((u) => u.value.user_id === userId);
  if (!row || parseAccountState(row.value.password_hash).kind === 'deleted') return fail(404, ADMIN_MSG.notFound);
  await deps.users.update(row.rowNumber, { password_hash: deletedCell(new Date(deps.now()).toISOString()) });
  const members = await deps.members.list();
  for (const m of members) {
    if (m.value.user_id === userId && !isTrue(m.value.removed)) await deps.members.update(m.rowNumber, { removed: TRUE });
  }
  return { status: 200, body: { ok: true } };
}

// ---- AI keys -----------------------------------------------------------------

export async function getKeys(deps: AdminDeps): Promise<Result> {
  const resolved = resolveProviders(await deps.settings.getAll(), deps.env, deps.secret);
  return { status: 200, body: { providers: providerViews(resolved), order: resolved.map((r) => r.id) } };
}

/** Body: { key?: string, model?: string }. An empty string clears the admin value (Vercel's applies again). */
export async function saveKey(deps: AdminDeps, id: string, body: unknown): Promise<Result> {
  if (!isProviderId(id)) return fail(404, ADMIN_MSG.badProvider);
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const at = new Date(deps.now()).toISOString();
  if (typeof b.key === 'string') {
    const key = b.key.trim();
    if (key.length > 500) return fail(400, 'La clave es demasiado larga.');
    await deps.settings.set(settingKey(id), key ? encryptSecret(key, deps.secret) : '', at);
  }
  if (typeof b.model === 'string') {
    const model = b.model.trim();
    if (model.length > 200 || /\s/.test(model)) return fail(400, 'El modelo no es válido.');
    await deps.settings.set(settingModel(id), model, at);
  }
  return getKeys(deps);
}

/** Body: { key?: string, model?: string } to test unsaved values; otherwise the current ones. */
export async function testKey(deps: AdminDeps, id: string, body: unknown): Promise<Result> {
  if (!isProviderId(id)) return fail(404, ADMIN_MSG.badProvider);
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const current = resolveProviders(await deps.settings.getAll(), deps.env, deps.secret).find((r) => r.id === id);
  const key = typeof b.key === 'string' && b.key.trim() ? b.key.trim() : current?.key;
  const model = typeof b.model === 'string' && b.model.trim() ? b.model.trim() : (current?.model ?? '');
  if (!key) return fail(400, ADMIN_MSG.noKey);
  return { status: 200, body: await deps.testKey(id, key, model) };
}
