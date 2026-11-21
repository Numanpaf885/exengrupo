/** Test helpers: in-memory deps and signed tokens. Imported only by *.test.ts files. */
import type { DataDeps } from './context';
import type { MemberRecord, PostRecord, SpaceRecord, UserRecord } from './schema';
import { signSession } from './session';
import { memoryTable } from './table';

export const TEST_SECRET = 'test-secret';
export const TEST_NOW = Date.UTC(2026, 10, 21, 10, 0, 0);

export function testDeps(users: Array<{ id: string; name: string }> = []) {
  let id = 0;
  let rand = 0;
  return {
    users: memoryTable<UserRecord>(
      users.map((u) => ({
        user_id: u.id,
        username: u.name,
        password_hash: 'x',
        created_at: '2026-01-01T00:00:00.000Z',
        last_login: '',
      })),
    ),
    spaces: memoryTable<SpaceRecord>(),
    members: memoryTable<MemberRecord>(),
    posts: memoryTable<PostRecord>(),
    secret: TEST_SECRET,
    now: () => TEST_NOW,
    newId: () => `id-${++id}`,
    randomIndex: (n: number) => rand++ % n,
    randomBytes: (n: number) => new Uint8Array(n).fill(7),
  } satisfies DataDeps;
}

export const bearer = (userId: string, username = userId): string =>
  `Bearer ${signSession({ userId, username }, TEST_SECRET, TEST_NOW)}`;
