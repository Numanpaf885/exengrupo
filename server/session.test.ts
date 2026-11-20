import { describe, expect, it } from 'vitest';
import { SESSION_DAYS, signSession, verifySession } from './session';

const SECRET = 'test-secret-not-real';
const user = { userId: 'u-1', username: 'ana' };
const DAY = 24 * 60 * 60 * 1000;

describe('session tokens', () => {
  it('round-trips a valid token', () => {
    const now = 1_700_000_000_000;
    const token = signSession(user, SECRET, now);
    expect(token.startsWith('v1.')).toBe(true);
    expect(verifySession(token, SECRET, now + DAY)).toEqual({
      sub: 'u-1',
      usr: 'ana',
      exp: now + SESSION_DAYS * DAY,
    });
  });

  it('expires after 30 days', () => {
    const now = 1_700_000_000_000;
    const token = signSession(user, SECRET, now);
    expect(verifySession(token, SECRET, now + 30 * DAY - 1)).not.toBeNull();
    expect(verifySession(token, SECRET, now + 30 * DAY)).toBeNull();
  });

  it('rejects a wrong secret or a tampered payload', () => {
    const token = signSession(user, SECRET);
    expect(verifySession(token, 'other-secret')).toBeNull();
    const [v, , sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', usr: 'x', exp: Date.now() + DAY })).toString(
      'base64url',
    );
    expect(verifySession(`${v}.${forged}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects junk', () => {
    expect(verifySession('', SECRET)).toBeNull();
    expect(verifySession('a.b', SECRET)).toBeNull();
    expect(verifySession('v2.x.y', SECRET)).toBeNull();
  });

  it('refuses to sign without a secret', () => {
    expect(() => signSession(user, '')).toThrow(/SESSION_SECRET/);
  });
});
