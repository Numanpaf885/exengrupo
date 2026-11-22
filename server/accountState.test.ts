import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  codeUsable,
  deletedCell,
  formatSetupCode,
  generateSetupCode,
  hashSetupCode,
  normalizeSetupCode,
  parseAccountState,
  pendingCell,
  sameHash,
  SETUP_MAX_ATTEMPTS,
} from './accountState';
import { decryptSecret, encryptSecret, keyHint } from './secretbox';

describe('one-time setup codes', () => {
  it('are 12 characters without look-alikes, shown as XXXX-XXXX-XXXX', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSetupCode((n) => randomInt(n));
      expect(code).toMatch(/^[A-Z2-9]{12}$/);
      expect(code).not.toMatch(/[01OILU]/);
    }
    expect(formatSetupCode('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN');
  });

  it('accept any spacing, hyphens or case', () => {
    expect(normalizeSetupCode(' abcd-efgh jkmn ')).toBe('ABCDEFGHJKMN');
    expect(hashSetupCode('abcd efgh-jkmn', 's')).toBe(hashSetupCode('ABCDEFGHJKMN', 's'));
    expect(hashSetupCode('ABCDEFGHJKMN', 's')).not.toBe(hashSetupCode('ABCDEFGHJKMN', 'other'));
  });

  it('compare in constant time', () => {
    expect(sameHash('abc', 'abc')).toBe(true);
    expect(sameHash('abc', 'abd')).toBe(false);
    expect(sameHash('abc', 'ab')).toBe(false);
  });
});

describe('account state in password_hash', () => {
  it('parses each state', () => {
    expect(parseAccountState('$2b$10$abc')).toEqual({ kind: 'active' });
    expect(parseAccountState(pendingCell('h', 123, 2))).toEqual({ kind: 'pending', hash: 'h', expiresAt: 123, attempts: 2 });
    expect(parseAccountState(deletedCell('2026-11-22T10:00:00.000Z'))).toEqual({ kind: 'deleted', at: '2026-11-22T10:00:00.000Z' });
  });

  it('knows when a code is still usable', () => {
    expect(codeUsable(parseAccountState(pendingCell('h', 1000, 0)), 999)).toBe(true);
    expect(codeUsable(parseAccountState(pendingCell('h', 1000, 0)), 1000)).toBe(false);
    expect(codeUsable(parseAccountState(pendingCell('h', 1000, SETUP_MAX_ATTEMPTS)), 1)).toBe(false);
    expect(codeUsable({ kind: 'active' }, 1)).toBe(false);
  });
});

describe('secretbox', () => {
  it('round-trips and refuses a different secret', () => {
    const enc = encryptSecret('sk-test-123456', 'secret-a');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain('sk-test');
    expect(decryptSecret(enc, 'secret-a')).toBe('sk-test-123456');
    expect(decryptSecret(enc, 'secret-b')).toBeNull();
    expect(decryptSecret('plain', 'secret-a')).toBeNull();
  });

  it('only hints the last 4 characters', () => {
    expect(keyHint('sk-abcdefgh1234')).toBe('…1234');
    expect(keyHint('short')).toBe('…');
  });
});
