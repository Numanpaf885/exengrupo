/** Shared dependencies and helpers for the space and post handlers. */
import { bearerToken, MSG, type Result, sessionUserValid } from './auth';
import type { MemberRecord, PostRecord, SpaceRecord, UserRecord } from './schema';
import type { SettingsStore } from './settings';
import { archivedIds } from './archive';
import { isOwner } from './creators';
import { type SessionPayload, verifySession } from './session';
import { isTrue, type Table } from './table';

export interface DataDeps {
  users: Table<UserRecord>;
  spaces: Table<SpaceRecord>;
  members: Table<MemberRecord>;
  posts: Table<PostRecord>;
  /** Sheet tab "ajustes" (AI keys, who may create spaces). */
  settings: SettingsStore;
  secret: string;
  now: () => number;
  newId: () => string;
  randomIndex: (n: number) => number;
  randomBytes: (n: number) => Uint8Array;
}

export const fail = (status: number, error: string): Result => ({ status, body: { error } });

export const SPACE_MSG = {
  notFound: 'Ese espacio no existe o ya no eres miembro.',
  creatorOnly: 'Solo quien creó el espacio puede hacer esto.',
  badCode: 'El código tiene 6 letras. Revísalo.',
  codeNotFound: 'No hay ningún espacio con ese código.',
  removed: 'Te quitaron de este espacio. Pide a quien lo creó que te vuelva a añadir.',
  cannotRemoveSelf: 'No puedes quitarte a ti mismo.',
  memberNotFound: 'Esa persona no es miembro del espacio.',
  cannotCreate: 'Solo el administrador y las personas que él elija pueden crear espacios.',
  badPeople: 'Alguna de las personas elegidas ya no existe. Recarga la lista.',
  cannotRemoveCreator: 'No se puede quitar a quien creó el espacio.',
  peopleDenied: 'Solo quien puede crear espacios ve la lista de personas.',
} as const;

/**
 * Verifies the Bearer token AND that its account is still active and unchanged
 * (a reset or deleted account signs out every device). Returns the session or a 401.
 */
export async function authenticate(deps: DataDeps, authorization: string | null): Promise<SessionPayload | Result> {
  const payload = verifySession(bearerToken(authorization) ?? '', deps.secret, deps.now());
  if (!payload) return fail(401, MSG.noSession);
  const users = await deps.users.list();
  const user = users.find((u) => u.value.user_id === payload.sub)?.value ?? null;
  return sessionUserValid(user, payload.pv) ? payload : fail(401, MSG.noSession);
}

export const isResult = (x: unknown): x is Result =>
  typeof x === 'object' && x !== null && 'status' in x && 'body' in x;

export interface Membership {
  space: SpaceRecord;
  spaceRow: number;
  member: MemberRecord;
  /** May manage the space (rename, members, archive, delete): its creator, or the owner (numan). */
  isCreator: boolean;
  archived: boolean;
}

/** The caller's active membership of an active space, or a 404 Result. */
export async function membership(deps: DataDeps, spaceId: string, userId: string): Promise<Membership | Result> {
  const [spaces, members, settings, users] = await Promise.all([
    deps.spaces.list(),
    deps.members.list(),
    deps.settings.getAll(),
    deps.users.list(),
  ]);
  const s = spaces.find((r) => r.value.space_id === spaceId && !isTrue(r.value.deleted));
  if (!s) return fail(404, SPACE_MSG.notFound);
  const m = members.find((r) => r.value.space_id === spaceId && r.value.user_id === userId && !isTrue(r.value.removed));
  if (!m) return fail(404, SPACE_MSG.notFound);
  return {
    space: s.value,
    spaceRow: s.rowNumber,
    member: m.value,
    isCreator: s.value.creator_id === userId || isOwner(users.find((u) => u.value.user_id === userId)?.value.username),
    archived: archivedIds(settings).has(spaceId),
  };
}

export const iso = (deps: DataDeps): string => new Date(deps.now()).toISOString();
