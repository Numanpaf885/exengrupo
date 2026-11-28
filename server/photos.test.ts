import { describe, expect, it } from 'vitest';
import { type AdminDeps, archiveSpaceAsAdmin, listSpaces } from './admin';
import { ARCHIVE_KEY, archivedIds } from './archive';
import { SPACE_MSG } from './context';
import { getPhoto, listPhotos, PHOTO_LINK_WINDOW_MS, type PhotoItem, signPhotoLink, verifyPhotoLink } from './photos';
import { createPost, type PostDeps } from './posts';
import { matchAdminRoute, matchSpacesRoute } from './router';
import { archiveSpace, createSpace, getSpace, joinSpace, listMySpaces, type SpaceDetail, type SpaceSummary } from './spaces';
import { memoryStorage } from './storage';
import { bearer, TEST_NOW, TEST_SECRET, testDeps } from './testing';
import { listPosts } from './posts';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

async function setup() {
  const base = testDeps([
    { id: 'ana', name: 'ana' },
    { id: 'luis', name: 'luis' },
    { id: 'eva', name: 'eva' },
  ]);
  const storage = memoryStorage();
  const deps: PostDeps & { storage: typeof storage } = {
    ...base,
    storage,
    analyze: async () => ({ status: 'done', answer: '1.a  2.V', models: 'gemini:m' }),
    broadcast: async () => undefined,
    log: () => undefined,
  };
  const space = ((await createSpace(deps, bearer('ana'), { name: 'Bio', member_ids: ['luis'] })).body as { space: SpaceSummary }).space;
  return { deps, base, storage, space };
}

describe('photo links', () => {
  it('verify only for the same space and post, until the window ends', () => {
    const t = signPhotoLink('s1', 'p1', TEST_SECRET, TEST_NOW);
    expect(verifyPhotoLink(t, TEST_SECRET, TEST_NOW)).toEqual({ spaceId: 's1', postId: 'p1' });
    expect(verifyPhotoLink(t, 'other-secret', TEST_NOW)).toBeNull();
    expect(verifyPhotoLink(t.replace(/.$/, 'x'), TEST_SECRET, TEST_NOW)).toBeNull();
    expect(verifyPhotoLink(t, TEST_SECRET, TEST_NOW + 2 * PHOTO_LINK_WINDOW_MS + 1)).toBeNull();
    expect(verifyPhotoLink('garbage', TEST_SECRET, TEST_NOW)).toBeNull();
  });

  it('stay the same within one 6-hour window (so the phone can cache the image)', () => {
    const start = Math.floor(TEST_NOW / PHOTO_LINK_WINDOW_MS) * PHOTO_LINK_WINDOW_MS;
    expect(signPhotoLink('s', 'p', TEST_SECRET, start)).toBe(signPhotoLink('s', 'p', TEST_SECRET, start + PHOTO_LINK_WINDOW_MS - 1));
    expect(signPhotoLink('s', 'p', TEST_SECRET, start)).not.toBe(signPhotoLink('s', 'p', TEST_SECRET, start + PHOTO_LINK_WINDOW_MS));
  });
});

describe('listPhotos / getPhoto', () => {
  it('lists the last 7 days of photos with signed links that open the JPEG', async () => {
    const { deps, base, space } = await setup();
    await createPost(deps, bearer('luis'), space.space_id, JPEG);
    // An old post whose photo R2 already deleted is left out.
    base.posts.rows.push({ ...base.posts.rows[0], post_id: 'old', photo_expires_at: '2026-11-01T00:00:00.000Z' });

    const res = await listPhotos(deps, bearer('ana'), space.space_id);
    const photos = (res.body as { photos: PhotoItem[] }).photos;
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ username: 'luis', status: 'done', answer: '1.a  2.V' });

    const url = new URL(photos[0].url, 'https://x');
    expect(url.pathname).toBe(`/api/spaces/${space.space_id}/photos/${photos[0].post_id}`);
    const ok = await getPhoto(deps, url.searchParams.get('t'), space.space_id, photos[0].post_id);
    expect(ok).toEqual({ status: 200, bytes: JPEG });
    // The link can't be reused for another photo or space.
    expect((await getPhoto(deps, url.searchParams.get('t'), space.space_id, 'other')).status).toBe(403);
    expect((await getPhoto(deps, null, space.space_id, photos[0].post_id)).status).toBe(403);
  });

  it('is for members only', async () => {
    const { deps, space } = await setup();
    expect((await listPhotos(deps, bearer('eva'), space.space_id)).status).toBe(404);
    expect((await listPhotos(deps, null, space.space_id)).status).toBe(401);
  });

  it('answers 404 when the photo is already gone from R2', async () => {
    const { deps, space, storage } = await setup();
    await createPost(deps, bearer('luis'), space.space_id, JPEG);
    storage.objects.clear();
    const photo = ((await listPhotos(deps, bearer('ana'), space.space_id)).body as { photos: PhotoItem[] }).photos[0];
    const t = new URL(photo.url, 'https://x').searchParams.get('t');
    expect((await getPhoto(deps, t, space.space_id, photo.post_id)).status).toBe(404);
  });
});

describe('archived spaces', () => {
  it('the creator archives: members lose it (list, feed, code), the creator still sees it marked', async () => {
    const { deps, base, space } = await setup();
    expect((await archiveSpace(deps, bearer('luis'), space.space_id, { archived: true })).status).toBe(403);
    expect((await archiveSpace(deps, bearer('ana'), space.space_id, { archived: 'yes' })).status).toBe(400);
    expect((await archiveSpace(deps, bearer('ana'), space.space_id, { archived: true })).status).toBe(200);
    expect(archivedIds(base.settings.values)).toEqual(new Set([space.space_id]));

    expect(((await listMySpaces(deps, bearer('luis'))).body as { spaces: unknown[] }).spaces).toEqual([]);
    expect((await listPosts(deps, bearer('luis'), space.space_id)).status).toBe(404);
    expect((await joinSpace(deps, bearer('eva'), { code: space.join_code })).body).toEqual({ error: SPACE_MSG.codeNotFound });

    const mine = ((await listMySpaces(deps, bearer('ana'))).body as { spaces: SpaceSummary[] }).spaces;
    expect(mine).toMatchObject([{ space_id: space.space_id, archived: true }]);
    expect(((await getSpace(deps, bearer('ana'), space.space_id)).body as { space: SpaceDetail }).space.archived).toBe(true);

    await archiveSpace(deps, bearer('ana'), space.space_id, { archived: false });
    expect(base.settings.values[ARCHIVE_KEY]).toBe('');
    expect(((await listMySpaces(deps, bearer('luis'))).body as { spaces: SpaceSummary[] }).spaces).toMatchObject([
      { space_id: space.space_id, archived: false },
    ]);
  });

  it('the admin archives any space and sees the flag in the list', async () => {
    const { deps, space } = await setup();
    const admin = deps as unknown as AdminDeps;
    expect((await archiveSpaceAsAdmin(admin, space.space_id, { archived: true })).status).toBe(200);
    expect(((await listSpaces(admin)).body as { spaces: Array<{ archived: boolean }> }).spaces[0].archived).toBe(true);
    expect((await archiveSpaceAsAdmin(admin, 'nope', { archived: true })).status).toBe(404);
    expect((await archiveSpaceAsAdmin(admin, space.space_id, {})).status).toBe(400);
    expect(((await listMySpaces(deps, bearer('luis'))).body as { spaces: unknown[] }).spaces).toEqual([]);
  });
});

describe('routes', () => {
  it('match photos and archive', () => {
    expect(matchSpacesRoute('GET', ['s1', 'photos'])).toEqual({ name: 'listPhotos', spaceId: 's1' });
    expect(matchSpacesRoute('GET', ['s1', 'photos', 'p1'])).toEqual({ name: 'getPhoto', spaceId: 's1', postId: 'p1' });
    expect(matchSpacesRoute('POST', ['s1', 'archive'])).toEqual({ name: 'archive', spaceId: 's1' });
    expect(matchAdminRoute('PUT', ['spaces', 's1', 'archive'])).toEqual({ name: 'archiveSpace', spaceId: 's1' });
  });
});
