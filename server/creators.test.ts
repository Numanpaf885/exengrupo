import { describe, expect, it } from 'vitest';
import {
  addSpaceMembers,
  type AdminDeps,
  createSpaceFor,
  deleteSpaceAsAdmin,
  listSpaces,
  listUsers,
  removeSpaceMember,
  setCreator,
} from './admin';
import { SPACE_MSG } from './context';
import { canCreateSpaces, CREATORS_KEY, creatorIds, idList } from './creators';
import { matchAdminRoute, matchSpacesRoute } from './router';
import { memorySettings } from './settings';
import {
  addMembers,
  createSpace,
  getSpace,
  joinSpace,
  listMySpaces,
  listPeople,
  removeMember,
  type SpaceDetail,
  type SpaceSummary,
} from './spaces';
import { bearer, testDeps } from './testing';

const people = [
  { id: 'u-numan', name: 'numan' },
  { id: 'u-ana', name: 'ana' },
  { id: 'u-luis', name: 'luis' },
  { id: 'u-eva', name: 'eva' },
];

/** Settings never saved: only "numan" may create spaces. */
function fresh() {
  const d = testDeps(people);
  d.settings = memorySettings();
  return d;
}

const user = (id: string) => ({ user_id: id, username: id, password_hash: 'x', created_at: '', last_login: '' });

describe('creatorIds', () => {
  it('defaults to numan until the admin saves the list', () => {
    expect([...creatorIds({}, [user('a'), { ...user('n'), username: 'numan' }])]).toEqual(['n']);
  });

  it('uses the saved list, and an empty list means nobody', () => {
    expect([...creatorIds({ [CREATORS_KEY]: 'a, b,,' }, [])]).toEqual(['a', 'b']);
    expect([...creatorIds({ [CREATORS_KEY]: '' }, [{ ...user('n'), username: 'numan' }])]).toEqual([]);
  });
});

describe('idList', () => {
  it('accepts a missing field or a list of strings, without duplicates', () => {
    expect(idList({}, 'member_ids')).toEqual([]);
    expect(idList({ member_ids: ['a', 'b', 'a'] }, 'member_ids')).toEqual(['a', 'b']);
  });

  it('rejects anything else', () => {
    expect(idList(null, 'x')).toBeNull();
    expect(idList({ x: 'a' }, 'x')).toBeNull();
    expect(idList({ x: [1] }, 'x')).toBeNull();
    expect(idList({ x: [''] }, 'x')).toBeNull();
    expect(idList({ x: Array(101).fill('a') }, 'x')).toBeNull();
  });
});

describe('who can create spaces', () => {
  it('only numan by default; others get a 403 and can_create false', async () => {
    const d = fresh();
    expect(await canCreateSpaces(d, 'u-numan')).toBe(true);
    const denied = await createSpace(d, bearer('u-ana'), { name: 'Bio' });
    expect(denied).toEqual({ status: 403, body: { error: SPACE_MSG.cannotCreate } });
    expect(d.spaces.rows).toHaveLength(0);
    expect((await listMySpaces(d, bearer('u-ana'))).body).toMatchObject({ can_create: false });
    expect((await listMySpaces(d, bearer('u-numan'))).body).toMatchObject({ can_create: true });
    expect((await createSpace(d, bearer('u-numan'), { name: 'Bio' })).status).toBe(201);
  });

  it('the admin switch adds and removes people without touching the others', async () => {
    const d = fresh();
    const admin = d as unknown as AdminDeps;
    expect((await setCreator(admin, 'u-ana', { can_create: true })).status).toBe(200);
    expect(d.settings.values[CREATORS_KEY].split(',').sort()).toEqual(['u-ana', 'u-numan']);
    expect((await createSpace(d, bearer('u-ana'), { name: 'Bio' })).status).toBe(201);

    await setCreator(admin, 'u-numan', { can_create: false });
    expect(d.settings.values[CREATORS_KEY]).toBe('u-ana');
    expect((await createSpace(d, bearer('u-numan'), { name: 'X' })).status).toBe(403);

    const users = ((await listUsers({ ...admin, settings: d.settings })).body as { users: Array<{ username: string; can_create: boolean }> }).users;
    expect(users.filter((u) => u.can_create).map((u) => u.username)).toEqual(['ana']);
    expect((await setCreator(admin, 'nobody', { can_create: true })).status).toBe(404);
    expect((await setCreator(admin, 'u-ana', { can_create: 'yes' })).status).toBe(400);
  });
});

describe('creating a space with people', () => {
  it('adds the chosen people at once: they see it without a code', async () => {
    const d = fresh();
    const res = await createSpace(d, bearer('u-numan'), { name: 'Física', member_ids: ['u-ana', 'u-luis', 'u-numan'] });
    expect(res.status).toBe(201);
    const space = (res.body as { space: SpaceSummary }).space;
    expect(space.member_count).toBe(3);
    expect(d.members.rows.map((m) => [m.user_id, m.role])).toEqual([
      ['u-numan', 'creator'],
      ['u-ana', 'member'],
      ['u-luis', 'member'],
    ]);
    const anaList = (await listMySpaces(d, bearer('u-ana'))).body as { spaces: SpaceSummary[] };
    expect(anaList.spaces.map((s) => s.name)).toEqual(['Física']);
    expect(((await listMySpaces(d, bearer('u-eva'))).body as { spaces: unknown[] }).spaces).toEqual([]);
    // The code still works for everyone else.
    expect((await joinSpace(d, bearer('u-eva'), { code: space.join_code })).status).toBe(201);
  });

  it('rejects unknown or deleted people and malformed lists', async () => {
    const d = fresh();
    expect((await createSpace(d, bearer('u-numan'), { name: 'A', member_ids: ['ghost'] })).body).toEqual({
      error: SPACE_MSG.badPeople,
    });
    d.users.rows.find((u) => u.user_id === 'u-eva')!.password_hash = 'deleted:v1:2026-01-01';
    expect((await createSpace(d, bearer('u-numan'), { name: 'A', member_ids: ['u-eva'] })).status).toBe(400);
    expect((await createSpace(d, bearer('u-numan'), { name: 'A', member_ids: 'u-ana' })).status).toBe(400);
    expect(d.spaces.rows).toHaveLength(0);
  });
});

describe('people list and adding members later', () => {
  it('lists everyone else (not deleted) to people who may create spaces or created one', async () => {
    const d = fresh();
    d.users.rows.find((u) => u.user_id === 'u-eva')!.password_hash = 'deleted:v1:2026-01-01';
    const res = await listPeople(d, bearer('u-numan'));
    expect((res.body as { people: Array<{ username: string }> }).people.map((p) => p.username)).toEqual(['ana', 'luis']);
    expect((await listPeople(d, bearer('u-ana'))).status).toBe(403);
    expect((await listPeople(d, null)).status).toBe(401);
  });

  it('the creator adds people (a removed member comes back); others cannot', async () => {
    const d = fresh();
    const space = ((await createSpace(d, bearer('u-numan'), { name: 'Q', member_ids: ['u-ana'] })).body as { space: SpaceSummary }).space;
    await removeMember(d, bearer('u-numan'), space.space_id, 'u-ana');

    expect((await addMembers(d, bearer('u-ana'), space.space_id, { user_ids: ['u-luis'] })).status).toBe(404);
    const res = await addMembers(d, bearer('u-numan'), space.space_id, { user_ids: ['u-ana', 'u-luis'] });
    expect(res.status).toBe(200);
    const detail = (res.body as { space: SpaceDetail }).space;
    expect(detail.members.map((m) => m.username).sort()).toEqual(['ana', 'luis', 'numan']);
    expect(d.members.rows.filter((m) => m.user_id === 'u-ana')).toHaveLength(1); // row reused

    expect((await addMembers(d, bearer('u-luis'), space.space_id, { user_ids: ['u-eva'] })).status).toBe(403);
    expect((await addMembers(d, bearer('u-numan'), space.space_id, { user_ids: [] })).status).toBe(400);
    expect((await addMembers(d, bearer('u-numan'), space.space_id, { user_ids: ['ghost'] })).status).toBe(400);
    // A creator who lost the permission can still manage the spaces they made.
    d.settings.values[CREATORS_KEY] = '';
    expect((await listPeople(d, bearer('u-numan'))).status).toBe(200);
  });
});

describe('admin spaces', () => {
  const admin = () => {
    const d = fresh();
    return { d, a: d as unknown as AdminDeps };
  };

  it('creates a space for any user, with members', async () => {
    const { d, a } = admin();
    const res = await createSpaceFor(a, { name: 'Química', creator_id: 'u-ana', member_ids: ['u-luis'] });
    expect(res.status).toBe(201);
    const id = (res.body as { space: SpaceSummary }).space.space_id;
    expect(d.spaces.rows[0].creator_id).toBe('u-ana');
    expect(((await getSpace(d, bearer('u-luis'), id)).body as { space: SpaceDetail }).space.is_creator).toBe(false);
    expect(((await getSpace(d, bearer('u-ana'), id)).body as { space: SpaceDetail }).space.is_creator).toBe(true);

    expect((await createSpaceFor(a, { name: 'X', creator_id: 'ghost' })).status).toBe(400);
    expect((await createSpaceFor(a, { name: '  ', creator_id: 'u-ana' })).status).toBe(400);
    expect((await createSpaceFor(a, { name: 'X' })).status).toBe(400);
  });

  it('lists every space with its members, adds, removes (not the creator) and deletes', async () => {
    const { d, a } = admin();
    const id = ((await createSpaceFor(a, { name: 'Q', creator_id: 'u-ana' })).body as { space: SpaceSummary }).space.space_id;

    expect((await addSpaceMembers(a, id, { user_ids: ['u-luis', 'u-eva'] })).status).toBe(200);
    expect((await removeSpaceMember(a, id, 'u-eva')).status).toBe(200);
    expect((await removeSpaceMember(a, id, 'u-eva')).status).toBe(404);
    expect((await removeSpaceMember(a, id, 'u-ana')).body).toEqual({ error: SPACE_MSG.cannotRemoveCreator });

    const list = (await listSpaces(a)).body as { spaces: Array<{ name: string; members: Array<{ username: string; is_creator: boolean }> }> };
    expect(list.spaces).toHaveLength(1);
    expect(list.spaces[0].members).toEqual([
      { user_id: 'u-ana', username: 'ana', is_creator: true },
      { user_id: 'u-luis', username: 'luis', is_creator: false },
    ]);

    expect((await deleteSpaceAsAdmin(a, id)).status).toBe(200);
    expect(d.spaces.rows[0].deleted).toBe('TRUE');
    expect(((await listSpaces(a)).body as { spaces: unknown[] }).spaces).toEqual([]);
    expect((await deleteSpaceAsAdmin(a, id)).status).toBe(404);
    expect((await addSpaceMembers(a, id, { user_ids: ['u-luis'] })).status).toBe(404);
  });
});

describe('routes', () => {
  it('spaces: people and add members', () => {
    expect(matchSpacesRoute('GET', ['people'])).toEqual({ name: 'people' });
    expect(matchSpacesRoute('POST', ['s1', 'members'])).toEqual({ name: 'addMembers', spaceId: 's1' });
  });

  it('admin: creator switch and spaces', () => {
    expect(matchAdminRoute('PUT', ['users', 'u1', 'creator'])).toEqual({ name: 'setCreator', userId: 'u1' });
    expect(matchAdminRoute('GET', ['spaces'])).toEqual({ name: 'listSpaces' });
    expect(matchAdminRoute('POST', ['spaces'])).toEqual({ name: 'createSpace' });
    expect(matchAdminRoute('DELETE', ['spaces', 's1'])).toEqual({ name: 'deleteSpace', spaceId: 's1' });
    expect(matchAdminRoute('POST', ['spaces', 's1', 'members'])).toEqual({ name: 'addMembers', spaceId: 's1' });
    expect(matchAdminRoute('DELETE', ['spaces', 's1', 'members', 'u2'])).toEqual({
      name: 'removeMember',
      spaceId: 's1',
      userId: 'u2',
    });
    expect(matchAdminRoute('GET', ['spaces', 's1'])).toEqual({ name: 'methodNotAllowed' });
  });
});
