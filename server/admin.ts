/**
 * Admin panel API. Sign-in with ADMIN_PASSWORD (Vercel env) → a 12-hour admin
 * token ("a1.…", separate from user tokens). The admin creates users and gets
 * a one-time code to hand over (shown once, stored only as a keyed hash),
 * gives a new code (which also signs that person out everywhere), deletes
 * users, chooses who may create spaces, manages every space (create for
 * users, add/remove members, delete), and manages the AI keys/models (Sheet
 * tab "ajustes", encrypted).
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
import { fail, SPACE_MSG } from './context';
import { creatorIds, idList, isListedUser, setCanCreate } from './creators';
import { spaceNameError } from '../src/lib/spaces/validation';
import { addMembersTo, insertSpace } from './spaces';
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
import { type OpenRouterCredits, usageStats } from './usage';

export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export interface AdminDeps extends DataDeps {
  adminPassword: string | undefined;
  settings: SettingsStore;
  env: Record<string, string | undefined>;
  testKey: (id: ProviderId, key: string, model: string) => Promise<KeyTest>;
  /** Free OpenRouter key-info lookup (credits used). */
  openRouterCredits?: (key: string) => Promise<OpenRouterCredits | null>;
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
  can_create: boolean;
}

export async function listUsers(deps: AdminDeps): Promise<Result> {
  const [users, members, settings] = await Promise.all([deps.users.list(), deps.members.list(), deps.settings.getAll()]);
  const creators = creatorIds(
    settings,
    users.map((u) => u.value),
  );
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
      can_create: creators.has(u.user_id),
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

/** Body: { can_create: boolean }. Who may create spaces from the app. */
export async function setCreator(deps: AdminDeps, userId: string, body: unknown): Promise<Result> {
  const allowed = body && typeof body === 'object' ? (body as Record<string, unknown>).can_create : null;
  if (typeof allowed !== 'boolean') return fail(400, 'Datos no válidos.');
  const users = await deps.users.list();
  const row = users.find((u) => u.value.user_id === userId);
  if (!row || !isListedUser(row.value)) return fail(404, ADMIN_MSG.notFound);
  await setCanCreate(deps, userId, allowed);
  return { status: 200, body: { user_id: userId, can_create: allowed } };
}

// ---- spaces --------------------------------------------------------------------

export interface AdminSpaceView {
  space_id: string;
  name: string;
  join_code: string;
  creator_id: string;
  created_at: string;
  members: Array<{ user_id: string; username: string; is_creator: boolean }>;
}

/** Every active space with its active members, newest first. */
export async function listSpaces(deps: AdminDeps): Promise<Result> {
  const [spaces, members, users] = await Promise.all([deps.spaces.list(), deps.members.list(), deps.users.list()]);
  const names = new Map(users.map((u) => [u.value.user_id, u.value.username]));
  const list: AdminSpaceView[] = spaces
    .map((r) => r.value)
    .filter((s) => !isTrue(s.deleted))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((s) => ({
      space_id: s.space_id,
      name: s.name,
      join_code: s.join_code,
      creator_id: s.creator_id,
      created_at: s.created_at,
      members: members
        .map((m) => m.value)
        .filter((m) => m.space_id === s.space_id && !isTrue(m.removed))
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
        .map((m) => ({
          user_id: m.user_id,
          username: names.get(m.user_id) ?? '—',
          is_creator: m.user_id === s.creator_id,
        })),
    }));
  return { status: 200, body: { spaces: list } };
}

async function knownUsers(deps: AdminDeps, ids: string[]): Promise<boolean> {
  const users = await deps.users.list();
  const known = new Set(users.map((u) => u.value).filter(isListedUser).map((u) => u.user_id));
  return ids.every((id) => known.has(id));
}

async function activeSpace(deps: AdminDeps, spaceId: string) {
  const spaces = await deps.spaces.list();
  return spaces.find((r) => r.value.space_id === spaceId && !isTrue(r.value.deleted)) ?? null;
}

/** Body: { name, creator_id, member_ids? }. The admin creates a space for a user. */
export async function createSpaceFor(deps: AdminDeps, body: unknown): Promise<Result> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const memberIds = idList(body, 'member_ids');
  if (typeof b.name !== 'string' || typeof b.creator_id !== 'string' || !b.creator_id || memberIds === null) {
    return fail(400, 'Datos no válidos.');
  }
  const invalid = spaceNameError(b.name);
  if (invalid) return fail(400, invalid);
  if (!(await knownUsers(deps, [b.creator_id, ...memberIds]))) return fail(400, SPACE_MSG.badPeople);
  const space = await insertSpace(deps, { name: b.name, creatorId: b.creator_id, memberIds });
  return { status: 201, body: { space } };
}

/** Body: { user_ids }. */
export async function addSpaceMembers(deps: AdminDeps, spaceId: string, body: unknown): Promise<Result> {
  const ids = idList(body, 'user_ids');
  if (ids === null || ids.length === 0) return fail(400, 'Datos no válidos.');
  if (!(await activeSpace(deps, spaceId))) return fail(404, SPACE_MSG.notFound);
  if (!(await knownUsers(deps, ids))) return fail(400, SPACE_MSG.badPeople);
  await addMembersTo(deps, spaceId, ids);
  return { status: 200, body: { ok: true } };
}

export async function removeSpaceMember(deps: AdminDeps, spaceId: string, userId: string): Promise<Result> {
  const space = await activeSpace(deps, spaceId);
  if (!space) return fail(404, SPACE_MSG.notFound);
  if (space.value.creator_id === userId) return fail(400, SPACE_MSG.cannotRemoveCreator);
  const members = await deps.members.list();
  const target = members.find(
    (r) => r.value.space_id === spaceId && r.value.user_id === userId && !isTrue(r.value.removed),
  );
  if (!target) return fail(404, SPACE_MSG.memberNotFound);
  await deps.members.update(target.rowNumber, { removed: TRUE });
  return { status: 200, body: { ok: true } };
}

/** Soft delete, like the creator's "Eliminar espacio". */
export async function deleteSpaceAsAdmin(deps: AdminDeps, spaceId: string): Promise<Result> {
  const space = await activeSpace(deps, spaceId);
  if (!space) return fail(404, SPACE_MSG.notFound);
  await deps.spaces.update(space.rowNumber, { deleted: TRUE });
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

// ---- AI usage ------------------------------------------------------------------

/** Counts from the posts tab, plus OpenRouter's credit use when it has a key. */
export async function getUsage(deps: AdminDeps): Promise<Result> {
  const [rows, settings] = await Promise.all([deps.posts.list(), deps.settings.getAll()]);
  const stats = usageStats(
    rows.map((r) => r.value),
    deps.now(),
  );
  const resolved = resolveProviders(settings, deps.env, deps.secret);
  const openrouter = resolved.find((r) => r.id === 'openrouter');
  const credits = openrouter?.key && deps.openRouterCredits ? await deps.openRouterCredits(openrouter.key) : null;
  const configured = Object.fromEntries(resolved.map((r) => [r.id, !!r.key]));
  return { status: 200, body: { ...stats, configured, openrouter_credits: credits } };
}
