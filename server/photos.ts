/**
 * "Fotos" screen of a space: the photos sent in the last 7 days (R2 deletes
 * them after that), newest first, each with its answer.
 *
 * The images are private in R2 and served through /api. An <img>/<Image> can't
 * send the session header, so each photo gets a signed link valid for one
 * 6-hour window: `p1.<base64url JSON {s,p,exp}>.<HMAC-SHA256>` in `?t=`. The
 * same link is given for the whole window, so the phone can cache the image.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Result } from './auth';
import { authenticate, type DataDeps, isResult, membership } from './context';
import { type PostView, toView } from './posts';
import { photoKey } from './storage';

export const PHOTO_LINK_WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_PHOTOS = 60;

export interface PhotoDeps extends DataDeps {
  storage: { get(key: string): Promise<Uint8Array | null> };
}

export interface PhotoItem extends PostView {
  /** Relative /api path with a signed `t`; the app adds its API base. */
  url: string;
}

const mac = (payload: string, secret: string) => createHmac('sha256', secret).update(`photo:${payload}`).digest('base64url');

/** Valid until the end of the next 6-hour window (between 6 and 12 hours from now). */
export function signPhotoLink(spaceId: string, postId: string, secret: string, now: number): string {
  const exp = (Math.floor(now / PHOTO_LINK_WINDOW_MS) + 2) * PHOTO_LINK_WINDOW_MS;
  const payload = Buffer.from(JSON.stringify({ s: spaceId, p: postId, exp })).toString('base64url');
  return `p1.${payload}.${mac(payload, secret)}`;
}

export function verifyPhotoLink(token: string, secret: string, now: number): { spaceId: string; postId: string } | null {
  const [v, payload, sig] = token.split('.');
  if (v !== 'p1' || !payload || !sig) return null;
  const expected = Buffer.from(mac(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { s?: string; p?: string; exp?: number };
    if (!p.s || !p.p || typeof p.exp !== 'number' || p.exp < now) return null;
    return { spaceId: p.s, postId: p.p };
  } catch {
    return null;
  }
}

export const photoPath = (spaceId: string, postId: string, token: string) =>
  `/api/spaces/${encodeURIComponent(spaceId)}/photos/${encodeURIComponent(postId)}?t=${encodeURIComponent(token)}`;

/** GET /api/spaces/:id/photos — members only. */
export async function listPhotos(deps: DataDeps, auth: string | null, spaceId: string): Promise<Result> {
  const session = await authenticate(deps, auth);
  if (isResult(session)) return session;
  const m = await membership(deps, spaceId, session.sub);
  if (isResult(m)) return m;
  const now = deps.now();
  const [rows, users] = await Promise.all([deps.posts.list(), deps.users.list()]);
  const names = new Map(users.map((u) => [u.value.user_id, u.value.username]));
  const photos: PhotoItem[] = rows
    .map((r) => r.value)
    .filter((p) => p.space_id === spaceId && p.photo_key && Date.parse(p.photo_expires_at) > now)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_PHOTOS)
    .map((p) => ({
      ...toView(p, names),
      url: photoPath(spaceId, p.post_id, signPhotoLink(spaceId, p.post_id, deps.secret, now)),
    }));
  return { status: 200, body: { photos } };
}

export type PhotoResult = { status: 200; bytes: Uint8Array } | { status: 403 | 404 };

/** GET /api/spaces/:id/photos/:postId?t=… — the JPEG, if the link is valid. No Sheet reads. */
export async function getPhoto(
  deps: Pick<PhotoDeps, 'storage' | 'secret' | 'now'>,
  token: string | null,
  spaceId: string,
  postId: string,
): Promise<PhotoResult> {
  const grant = verifyPhotoLink(token ?? '', deps.secret, deps.now());
  if (!grant || grant.spaceId !== spaceId || grant.postId !== postId) return { status: 403 };
  const bytes = await deps.storage.get(photoKey(spaceId, postId));
  return bytes ? { status: 200, bytes } : { status: 404 };
}
