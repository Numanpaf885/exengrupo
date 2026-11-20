/** Users table access. The `users` tab headers are fixed:
 *  user_id, username, password_hash, created_at, last_login */
import type { SheetsClient } from './sheets';

export interface UserRow {
  user_id: string;
  username: string;
  password_hash: string;
  created_at: string;
  last_login: string;
}

export interface UserStore {
  findByUsername(username: string): Promise<UserRow | null>;
  findById(userId: string): Promise<UserRow | null>;
  create(user: UserRow): Promise<void>;
  touchLogin(userId: string, at: string): Promise<void>;
}

const TAB = 'users';

export function sheetsUserStore(client: SheetsClient): UserStore {
  const load = async () => {
    const table = await client.readTable(TAB);
    const users = table.records.map((r) => ({ rowNumber: r.rowNumber, user: r.values as unknown as UserRow }));
    return { headers: table.headers, users };
  };
  return {
    async findByUsername(username) {
      const { users } = await load();
      return users.find((u) => u.user.username.toLowerCase() === username)?.user ?? null;
    },
    async findById(userId) {
      const { users } = await load();
      return users.find((u) => u.user.user_id === userId)?.user ?? null;
    },
    async create(user) {
      const { headers } = await load();
      await client.appendRecord(TAB, headers, { ...user });
    },
    async touchLogin(userId, at) {
      const { headers, users } = await load();
      const found = users.find((u) => u.user.user_id === userId);
      if (found) await client.updateCells(TAB, headers, found.rowNumber, { last_login: at });
    },
  };
}
