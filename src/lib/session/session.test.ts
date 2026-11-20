import { describe, expect, it } from 'vitest';
import { parseStoredSession, serializeSession } from './session';

const s = { token: 'v1.a.b', user: { user_id: 'u1', username: 'ana' } };

describe('stored session', () => {
  it('round-trips', () => {
    expect(parseStoredSession(serializeSession(s))).toEqual(s);
  });

  it('rejects missing, corrupted or incomplete values', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('{oops')).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: '', user: s.user }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: 'x' }))).toBeNull();
  });
});
