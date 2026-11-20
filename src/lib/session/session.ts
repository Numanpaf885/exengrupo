/** Stored session shape and (de)serialization. Pure, unit-tested. */
export interface SessionUser {
  user_id: string;
  username: string;
}

export interface StoredSession {
  token: string;
  user: SessionUser;
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof s.token === 'string' &&
      s.token.length > 0 &&
      typeof s.user?.user_id === 'string' &&
      typeof s.user?.username === 'string'
    ) {
      return { token: s.token, user: { user_id: s.user.user_id, username: s.user.username } };
    }
  } catch {
    // corrupted value
  }
  return null;
}

export function serializeSession(s: StoredSession): string {
  return JSON.stringify(s);
}
