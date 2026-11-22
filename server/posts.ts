/**
 * Photos → answers. Upload (multipart, JPEG ≤ 3 MB) → R2 → posts row
 * "processing" → broadcast {post_id} → two AIs → merge → save → broadcast {post_id}.
 */
import type { Result } from './auth';
import type { AiOutcome } from './ai/analyze';
import { AI_FAILED } from './ai/answers';
import { authenticate, type DataDeps, fail, isResult, iso, membership } from './context';
import type { Broadcaster } from './realtime';
import { POST_DONE, POST_ERROR, POST_PROCESSING, type PostRecord } from './schema';
import { photoKey, type PhotoStorage } from './storage';

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const PHOTO_DAYS = 7;
const FEED_LIMIT = 50;

export const POST_MSG = {
  noPhoto: 'No llegó ninguna foto. Prueba de nuevo.',
  tooBig: 'La foto pesa demasiado (máximo 3 MB).',
  notJpeg: 'La foto debe ser JPEG.',
  notFound: 'Esa foto no existe.',
} as const;

export interface PostDeps extends DataDeps {
  storage: PhotoStorage;
  analyze: (jpegBase64: string) => Promise<AiOutcome>;
  broadcast: Broadcaster;
  log: (message: string) => void;
}

export interface PostView {
  post_id: string;
  user_id: string;
  username: string;
  status: string;
  answer: string;
  created_at: string;
}

function toView(p: PostRecord, names: Map<string, string>): PostView {
  return {
    post_id: p.post_id,
    user_id: p.user_id,
    username: names.get(p.user_id) ?? '—',
    status: p.status,
    answer: p.answer,
    created_at: p.created_at,
  };
}

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Broadcast failures never break the request: clients also refresh on their own. */
async function safeBroadcast(deps: PostDeps, channelId: string, postId: string) {
  try {
    await deps.broadcast(channelId, postId);
  } catch (e) {
    deps.log(`broadcast failed: ${e instanceof Error ? e.message : 'unknown'}`);
  }
}

export async function createPost(
  deps: PostDeps,
  auth: string | null,
  spaceId: string,
  photo: Uint8Array | null,
): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  if (!photo || photo.length === 0) return fail(400, POST_MSG.noPhoto);
  if (photo.length > MAX_PHOTO_BYTES) return fail(413, POST_MSG.tooBig);
  if (!isJpeg(photo)) return fail(415, POST_MSG.notJpeg);

  const postId = deps.newId();
  const key = photoKey(spaceId, postId);
  await deps.storage.put(key, photo, 'image/jpeg');

  const createdAt = iso(deps);
  const record: PostRecord = {
    post_id: postId,
    space_id: spaceId,
    user_id: session.sub,
    photo_key: key,
    status: POST_PROCESSING,
    answer: '',
    models: '',
    created_at: createdAt,
    photo_expires_at: new Date(deps.now() + PHOTO_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
  await deps.posts.append(record);
  await safeBroadcast(deps, m.space.channel_id, postId);

  let outcome: AiOutcome;
  try {
    outcome = await deps.analyze(Buffer.from(photo).toString('base64'));
  } catch (e) {
    deps.log(`analyze failed: ${e instanceof Error ? e.message : 'unknown'}`);
    outcome = { status: 'error', answer: AI_FAILED, models: '' };
  }

  const rows = await deps.posts.list();
  const row = rows.find((r) => r.value.post_id === postId);
  const patch = {
    status: outcome.status === 'done' ? POST_DONE : POST_ERROR,
    answer: outcome.answer,
    models: outcome.models,
  };
  if (row) await deps.posts.update(row.rowNumber, patch);
  await safeBroadcast(deps, m.space.channel_id, postId);

  const names = new Map([[session.sub, session.usr]]);
  return { status: 201, body: { post: toView({ ...record, ...patch }, names) } };
}

async function usernames(deps: DataDeps): Promise<Map<string, string>> {
  const users = await deps.users.list();
  return new Map(users.map((u) => [u.value.user_id, u.value.username]));
}

export async function listPosts(deps: DataDeps, auth: string | null, spaceId: string): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  const [rows, names] = await Promise.all([deps.posts.list(), usernames(deps)]);
  const posts = rows
    .map((r) => r.value)
    .filter((p) => p.space_id === spaceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, FEED_LIMIT)
    .map((p) => toView(p, names));
  return { status: 200, body: { posts } };
}

export async function getPost(deps: DataDeps, auth: string | null, spaceId: string, postId: string) {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  const [rows, names] = await Promise.all([deps.posts.list(), usernames(deps)]);
  const post = rows.map((r) => r.value).find((p) => p.post_id === postId && p.space_id === spaceId);
  if (!post) return fail(404, POST_MSG.notFound);
  return { status: 200, body: { post: toView(post, names) } };
}
