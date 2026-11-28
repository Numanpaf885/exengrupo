import { describe, expect, it } from 'vitest';
import { SPACE_MSG } from './context';
import {
  createSpace,
  deleteSpace,
  getSpace,
  joinSpace,
  listMySpaces,
  removeMember,
  renameSpace,
  type SpaceDetail,
  type SpaceSummary,
} from './spaces';
import { bearer, testDeps } from './testing';

const people = [
  { id: 'ana', name: 'ana' },
  { id: 'luis', name: 'luis' },
  { id: 'eva', name: 'eva' },
];

async function setup() {
  const d = testDeps(people);
  const res = await createSpace(d, bearer('ana'), { name: '  Física   2º ' });
  const space = (res.body as { space: SpaceSummary }).space;
  return { d, space };
}

describe('createSpace', () => {
  it('creates the space and makes the caller its creator', async () => {
    const { d, space } = await setup();
    expect(space).toMatchObject({ name: 'Física 2º', is_creator: true, member_count: 1 });
    expect(space.join_code).toMatch(/^[A-Z]{6}$/);
    const row = d.spaces.rows[0];
    expect(row.channel_id.length).toBeGreaterThanOrEqual(32);
    expect(row).toMatchObject({ creator_id: 'ana', deleted: 'FALSE', created_at: '2026-11-21T10:00:00.000Z' });
    expect(d.members.rows).toEqual([
      { space_id: space.space_id, user_id: 'ana', role: 'creator', joined_at: row.created_at, removed: 'FALSE' },
    ]);
  });

  it('requires a session and a valid name', async () => {
    const d = testDeps(people);
    expect((await createSpace(d, null, { name: 'x' })).status).toBe(401);
    expect((await createSpace(d, bearer('ana'), { name: '   ' })).status).toBe(400);
    expect((await createSpace(d, bearer('ana'), { name: 'x'.repeat(41) })).status).toBe(400);
  });
});

describe('joinSpace', () => {
  it('joins by code (any spacing or case) and is idempotent', async () => {
    const { d, space } = await setup();
    const code = space.join_code.toLowerCase().replace(/(...)/, '$1 ');
    expect((await joinSpace(d, bearer('luis'), { code })).status).toBe(201);
    expect((await joinSpace(d, bearer('luis'), { code: space.join_code })).status).toBe(200);
    expect(d.members.rows.filter((m) => m.user_id === 'luis')).toHaveLength(1);
    expect(d.members.rows[1]).toMatchObject({ role: 'member', removed: 'FALSE' });
  });

  it('rejects bad, unknown and deleted codes', async () => {
    const { d, space } = await setup();
    expect((await joinSpace(d, bearer('luis'), { code: 'ABC' })).body).toEqual({ error: SPACE_MSG.badCode });
    expect((await joinSpace(d, bearer('luis'), { code: 'ZZZZZZ' })).status).toBe(404);
    await deleteSpace(d, bearer('ana'), space.space_id);
    expect((await joinSpace(d, bearer('luis'), { code: space.join_code })).status).toBe(404);
  });

  it('does not let a removed member rejoin', async () => {
    const { d, space } = await setup();
    await joinSpace(d, bearer('luis'), { code: space.join_code });
    await removeMember(d, bearer('ana'), space.space_id, 'luis');
    expect(await joinSpace(d, bearer('luis'), { code: space.join_code })).toEqual({
      status: 403,
      body: { error: SPACE_MSG.removed },
    });
  });
});

describe('listing and details', () => {
  it('lists only my active spaces with member counts', async () => {
    const { d, space } = await setup();
    await joinSpace(d, bearer('luis'), { code: space.join_code });
    await createSpace(d, bearer('eva'), { name: 'Otro' });
    const mine = (await listMySpaces(d, bearer('luis'))).body as { spaces: SpaceSummary[] };
    expect(mine.spaces).toEqual([
      { space_id: space.space_id, name: 'Física 2º', join_code: space.join_code, is_creator: false, member_count: 2, archived: false },
    ]);
  });

  it('shows members with usernames to members only', async () => {
    const { d, space } = await setup();
    await joinSpace(d, bearer('luis'), { code: space.join_code });
    const res = await getSpace(d, bearer('luis'), space.space_id);
    const detail = (res.body as { space: SpaceDetail }).space;
    expect(detail.is_creator).toBe(false);
    expect(detail.channel_id.length).toBeGreaterThanOrEqual(32);
    expect(detail.members).toEqual([
      { user_id: 'ana', username: 'ana', is_creator: true },
      { user_id: 'luis', username: 'luis', is_creator: false },
    ]);
    expect((await getSpace(d, bearer('eva'), space.space_id)).status).toBe(404);
  });
});

describe('creator-only actions', () => {
  it('renames only for the creator', async () => {
    const { d, space } = await setup();
    await joinSpace(d, bearer('luis'), { code: space.join_code });
    expect((await renameSpace(d, bearer('luis'), space.space_id, { name: 'X' })).status).toBe(403);
    expect((await renameSpace(d, bearer('ana'), space.space_id, { name: ' Química ' })).status).toBe(200);
    expect(d.spaces.rows[0].name).toBe('Química');
  });

  it('removes members (soft) but never the creator themself', async () => {
    const { d, space } = await setup();
    await joinSpace(d, bearer('luis'), { code: space.join_code });
    expect((await removeMember(d, bearer('luis'), space.space_id, 'ana')).status).toBe(403);
    expect((await removeMember(d, bearer('ana'), space.space_id, 'ana')).status).toBe(400);
    expect((await removeMember(d, bearer('ana'), space.space_id, 'luis')).status).toBe(200);
    expect(d.members.rows.find((m) => m.user_id === 'luis')?.removed).toBe('TRUE');
    expect((await getSpace(d, bearer('luis'), space.space_id)).status).toBe(404);
    expect((await removeMember(d, bearer('ana'), space.space_id, 'luis')).status).toBe(404);
  });

  it('soft-deletes the space', async () => {
    const { d, space } = await setup();
    await joinSpace(d, bearer('luis'), { code: space.join_code });
    expect((await deleteSpace(d, bearer('luis'), space.space_id)).status).toBe(403);
    expect((await deleteSpace(d, bearer('ana'), space.space_id)).status).toBe(200);
    expect(d.spaces.rows[0].deleted).toBe('TRUE');
    expect(((await listMySpaces(d, bearer('ana'))).body as { spaces: unknown[] }).spaces).toEqual([]);
  });

  it('treats a ticked checkbox (TRUE) in the sheet as deleted', async () => {
    const { d, space } = await setup();
    d.spaces.rows[0].deleted = 'true';
    expect((await getSpace(d, bearer('ana'), space.space_id)).status).toBe(404);
  });
});
