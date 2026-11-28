/**
 * Who may create spaces (user decision 2026-11-23): only the people the admin
 * picks. Stored in the "ajustes" tab as `space_creators` = comma-separated
 * user_ids (no Sheet schema change). Until the admin saves it the first time,
 * the default is the user "numan". An empty value means nobody (only the admin,
 * from the admin panel).
 */
import { parseAccountState } from './accountState';
import type { DataDeps } from './context';
import type { UserRecord } from './schema';

export const CREATORS_KEY = 'space_creators';
export const OWNER_USERNAME = 'numan';
export const DEFAULT_CREATOR_USERNAMES = [OWNER_USERNAME];

/** The owner manages every space he is in, like its creator (user decision 2026-11-28). */
export const isOwner = (username: string | undefined): boolean => username === OWNER_USERNAME;

export function creatorIds(settings: Record<string, string>, users: UserRecord[]): Set<string> {
  const saved = settings[CREATORS_KEY];
  if (saved === undefined) {
    return new Set(users.filter((u) => DEFAULT_CREATOR_USERNAMES.includes(u.username)).map((u) => u.user_id));
  }
  return new Set(
    saved
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function canCreateSpaces(deps: DataDeps, userId: string): Promise<boolean> {
  const [settings, users] = await Promise.all([deps.settings.getAll(), deps.users.list()]);
  return creatorIds(
    settings,
    users.map((u) => u.value),
  ).has(userId);
}

/** Turns the permission on or off for one user (keeps everyone else as they are). */
export async function setCanCreate(deps: DataDeps, userId: string, allowed: boolean): Promise<void> {
  const [settings, users] = await Promise.all([deps.settings.getAll(), deps.users.list()]);
  const ids = creatorIds(
    settings,
    users.map((u) => u.value),
  );
  if (allowed) ids.add(userId);
  else ids.delete(userId);
  await deps.settings.set(CREATORS_KEY, [...ids].join(','), new Date(deps.now()).toISOString());
}

/** Users that can be added to a space: every account that isn't deleted (pending ones see it once they activate). */
export const isListedUser = (u: UserRecord): boolean => !!u.user_id && parseAccountState(u.password_hash).kind !== 'deleted';

export interface Person {
  user_id: string;
  username: string;
}

export function people(users: UserRecord[]): Person[] {
  return users
    .filter(isListedUser)
    .map((u) => ({ user_id: u.user_id, username: u.username }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

/** The `user_ids` / `member_ids` array of a request body: strings only, no duplicates. Null when malformed. */
export function idList(body: unknown, field: string, max = 100): string[] | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>)[field];
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > max || raw.some((x) => typeof x !== 'string' || !x || x.length > 100)) {
    return null;
  }
  return [...new Set(raw as string[])];
}
