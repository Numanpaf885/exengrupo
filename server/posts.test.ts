import { describe, expect, it, vi } from 'vitest';
import type { AiOutcome } from './ai/analyze';
import { createPost, getPost, listPosts, MAX_PHOTO_BYTES, type PostDeps, type PostView } from './posts';
import { createSpace, joinSpace, type SpaceSummary } from './spaces';
import { bearer, testDeps } from './testing';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

async function setup(outcome: AiOutcome | Error = { status: 'done', answer: '1.a  2.V', models: 'gemini:m' }) {
  const base = testDeps([
    { id: 'ana', name: 'ana' },
    { id: 'luis', name: 'luis' },
    { id: 'eva', name: 'eva' },
  ]);
  const put = vi.fn(async (_k: string, _b: Uint8Array, _t: string) => undefined);
  const broadcast = vi.fn(async (_c: string, _p: string) => undefined);
  const analyze = vi.fn(async (_b64: string) => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  const deps: PostDeps = { ...base, storage: { put }, analyze, broadcast, log: () => undefined };
  const space = ((await createSpace(deps, bearer('ana'), { name: 'Bio' })).body as { space: SpaceSummary }).space;
  await joinSpace(deps, bearer('luis'), { code: space.join_code });
  return { deps, base, space, put, broadcast, analyze };
}

describe('createPost', () => {
  it('still saves the answer when the early row read missed the new row', async () => {
    const { deps, base, space } = await setup();
    const real = base.posts.list.bind(base.posts);
    let calls = 0;
    deps.posts = { ...base.posts, list: async () => (++calls === 1 ? [] : real()) };
    const res = await createPost(deps, bearer('luis'), space.space_id, JPEG);
    expect(res.status).toBe(201);
    expect(base.posts.rows[0]).toMatchObject({ status: 'done', answer: '1.a  2.V' });
  });

  it('stores the photo, saves the answer and broadcasts only the post id', async () => {
    const { deps, base, space, put, broadcast, analyze } = await setup();
    const res = await createPost(deps, bearer('luis'), space.space_id, JPEG);
    expect(res.status).toBe(201);
    const post = (res.body as { post: PostView }).post;
    expect(post).toMatchObject({ username: 'luis', status: 'done', answer: '1.a  2.V' });

    expect(put).toHaveBeenCalledWith(`spaces/${space.space_id}/${post.post_id}.jpg`, JPEG, 'image/jpeg');
    expect(analyze).toHaveBeenCalledWith(Buffer.from(JPEG).toString('base64'), space.space_id);
    const channel = base.spaces.rows[0].channel_id;
    expect(broadcast.mock.calls).toEqual([
      [channel, post.post_id],
      [channel, post.post_id],
    ]);

    const row = base.posts.rows[0];
    expect(row).toMatchObject({
      post_id: post.post_id,
      user_id: 'luis',
      photo_key: `spaces/${space.space_id}/${post.post_id}.jpg`,
      status: 'done',
      answer: '1.a  2.V',
      models: 'gemini:m',
      created_at: '2026-11-21T10:00:00.000Z',
      photo_expires_at: '2026-11-28T10:00:00.000Z',
    });
  });

  it('saves AI error messages as status "error"', async () => {
    const { deps, base, space } = await setup({ status: 'error', answer: 'No se lee bien, repite la foto', models: '' });
    await createPost(deps, bearer('ana'), space.space_id, JPEG);
    expect(base.posts.rows[0]).toMatchObject({ status: 'error', answer: 'No se lee bien, repite la foto' });
  });

  it('survives an AI crash and a broadcast failure', async () => {
    const { deps, base, space, broadcast } = await setup(new Error('boom'));
    broadcast.mockRejectedValue(new Error('supabase down'));
    const res = await createPost(deps, bearer('ana'), space.space_id, JPEG);
    expect(res.status).toBe(201);
    expect(base.posts.rows[0]).toMatchObject({ status: 'error', answer: 'No se pudo analizar la foto. Prueba de nuevo.' });
  });

  it('rejects non-members, missing, huge or non-JPEG photos', async () => {
    const { deps, space, put } = await setup();
    expect((await createPost(deps, bearer('eva'), space.space_id, JPEG)).status).toBe(404);
    expect((await createPost(deps, bearer('ana'), space.space_id, null)).status).toBe(400);
    const huge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    huge.set(JPEG);
    expect((await createPost(deps, bearer('ana'), space.space_id, huge)).status).toBe(413);
    expect((await createPost(deps, bearer('ana'), space.space_id, new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).status).toBe(415);
    expect(put).not.toHaveBeenCalled();
  });
});

describe('feed', () => {
  it('lists newest first and fetches single posts for members only', async () => {
    const { deps, base, space } = await setup();
    await createPost(deps, bearer('ana'), space.space_id, JPEG);
    base.posts.rows[0].created_at = '2026-11-21T09:00:00.000Z';
    await createPost(deps, bearer('luis'), space.space_id, JPEG);
    const feed = ((await listPosts(deps, bearer('ana'), space.space_id)).body as { posts: PostView[] }).posts;
    expect(feed.map((p) => p.username)).toEqual(['luis', 'ana']);
    expect(await getPost(deps, bearer('luis'), space.space_id, feed[1].post_id)).toMatchObject({ status: 200 });
    expect((await getPost(deps, bearer('eva'), space.space_id, feed[1].post_id)).status).toBe(404);
    expect((await getPost(deps, bearer('ana'), space.space_id, 'nope')).status).toBe(404);
  });
});
