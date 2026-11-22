/** Spaces: create, join by code, list mine, details + members, and creator-only actions. */
import { normalizeSpaceName, spaceNameError } from '../src/lib/spaces/validation';
import type { Result } from './auth';
import { channelIdFromBytes, normalizeJoinCode, uniqueJoinCode } from './codes';
import { authenticate, type DataDeps, fail, isResult, iso, membership, SPACE_MSG } from './context';
import { ROLE_CREATOR, ROLE_MEMBER, type SpaceRecord } from './schema';
import { FALSE, isTrue, TRUE } from './table';

export interface SpaceSummary {
  space_id: string;
  name: string;
  join_code: string;
  is_creator: boolean;
  member_count: number;
}

export interface SpaceDetail extends SpaceSummary {
  channel_id: string;
  members: Array<{ user_id: string; username: string; is_creator: boolean }>;
}

function nameFrom(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const { name } = body as Record<string, unknown>;
  return typeof name === 'string' ? name : null;
}

export async function listMySpaces(deps: DataDeps, auth: string | null): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const [spaces, members] = await Promise.all([deps.spaces.list(), deps.members.list()]);
  const active = members.filter((m) => !isTrue(m.value.removed));
  const mine = new Set(active.filter((m) => m.value.user_id === session.sub).map((m) => m.value.space_id));
  const list: SpaceSummary[] = spaces
    .map((s) => s.value)
    .filter((s) => mine.has(s.space_id) && !isTrue(s.deleted))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((s) => ({
      space_id: s.space_id,
      name: s.name,
      join_code: s.join_code,
      is_creator: s.creator_id === session.sub,
      member_count: active.filter((m) => m.value.space_id === s.space_id).length,
    }));
  return { status: 200, body: { spaces: list } };
}

export async function createSpace(deps: DataDeps, auth: string | null, body: unknown): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const raw = nameFrom(body);
  if (raw === null) return fail(400, 'Datos no válidos.');
  const invalid = spaceNameError(raw);
  if (invalid) return fail(400, invalid);

  const spaces = await deps.spaces.list();
  const taken = new Set(spaces.filter((s) => !isTrue(s.value.deleted)).map((s) => s.value.join_code));
  const at = iso(deps);
  const space: SpaceRecord = {
    space_id: deps.newId(),
    name: normalizeSpaceName(raw),
    join_code: uniqueJoinCode(taken, deps.randomIndex),
    channel_id: channelIdFromBytes(deps.randomBytes(24)),
    creator_id: session.sub,
    created_at: at,
    deleted: FALSE,
  };
  await deps.spaces.append(space);
  await deps.members.append({
    space_id: space.space_id,
    user_id: session.sub,
    role: ROLE_CREATOR,
    joined_at: at,
    removed: FALSE,
  });
  const summary: SpaceSummary = {
    space_id: space.space_id,
    name: space.name,
    join_code: space.join_code,
    is_creator: true,
    member_count: 1,
  };
  return { status: 201, body: { space: summary } };
}

export async function joinSpace(deps: DataDeps, auth: string | null, body: unknown): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).code : null;
  const code = typeof raw === 'string' ? normalizeJoinCode(raw) : null;
  if (!code) return fail(400, SPACE_MSG.badCode);

  const [spaces, members] = await Promise.all([deps.spaces.list(), deps.members.list()]);
  const space = spaces.find((s) => s.value.join_code === code && !isTrue(s.value.deleted))?.value;
  if (!space) return fail(404, SPACE_MSG.codeNotFound);
  const mine = members.filter((m) => m.value.space_id === space.space_id && m.value.user_id === session.sub);
  if (mine.some((m) => !isTrue(m.value.removed))) {
    return { status: 200, body: { space: { space_id: space.space_id, name: space.name } } };
  }
  if (mine.length > 0) return fail(403, SPACE_MSG.removed);

  await deps.members.append({
    space_id: space.space_id,
    user_id: session.sub,
    role: ROLE_MEMBER,
    joined_at: iso(deps),
    removed: FALSE,
  });
  return { status: 201, body: { space: { space_id: space.space_id, name: space.name } } };
}

export async function getSpace(deps: DataDeps, auth: string | null, spaceId: string): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  const [members, users] = await Promise.all([deps.members.list(), deps.users.list()]);
  const names = new Map(users.map((u) => [u.value.user_id, u.value.username]));
  const active = members
    .map((r) => r.value)
    .filter((r) => r.space_id === spaceId && !isTrue(r.removed))
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const detail: SpaceDetail = {
    space_id: m.space.space_id,
    name: m.space.name,
    join_code: m.space.join_code,
    channel_id: m.space.channel_id,
    is_creator: m.isCreator,
    member_count: active.length,
    members: active.map((r) => ({
      user_id: r.user_id,
      username: names.get(r.user_id) ?? '—',
      is_creator: r.user_id === m.space.creator_id,
    })),
  };
  return { status: 200, body: { space: detail } };
}

export async function renameSpace(deps: DataDeps, auth: string | null, spaceId: string, body: unknown) {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  if (!m.isCreator) return fail(403, SPACE_MSG.creatorOnly);
  const raw = nameFrom(body);
  if (raw === null) return fail(400, 'Datos no válidos.');
  const invalid = spaceNameError(raw);
  if (invalid) return fail(400, invalid);
  const name = normalizeSpaceName(raw);
  await deps.spaces.update(m.spaceRow, { name });
  return { status: 200, body: { space: { space_id: spaceId, name } } };
}

export async function deleteSpace(deps: DataDeps, auth: string | null, spaceId: string): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  if (!m.isCreator) return fail(403, SPACE_MSG.creatorOnly);
  await deps.spaces.update(m.spaceRow, { deleted: TRUE }); // soft delete
  return { status: 200, body: { ok: true } };
}

export async function removeMember(
  deps: DataDeps,
  auth: string | null,
  spaceId: string,
  userId: string,
): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  if (!m.isCreator) return fail(403, SPACE_MSG.creatorOnly);
  if (userId === session.sub) return fail(400, SPACE_MSG.cannotRemoveSelf);
  const members = await deps.members.list();
  const target = members.find(
    (r) => r.value.space_id === spaceId && r.value.user_id === userId && !isTrue(r.value.removed),
  );
  if (!target) return fail(404, SPACE_MSG.memberNotFound);
  await deps.members.update(target.rowNumber, { removed: TRUE }); // soft remove
  return { status: 200, body: { ok: true } };
}
