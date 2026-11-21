import { randomBytes, randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  channelIdFromBytes,
  generateJoinCode,
  JOIN_ALPHABET,
  normalizeJoinCode,
  uniqueJoinCode,
} from './codes';

describe('join codes', () => {
  it('are 6 letters from the readable alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode((n) => randomInt(n));
      expect(code).toMatch(/^[A-Z]{6}$/);
      expect(code).not.toMatch(/[ILO]/);
    }
  });

  it('is deterministic for a given random source', () => {
    expect(generateJoinCode(() => 0)).toBe('AAAAAA');
    expect(generateJoinCode((n) => n - 1)).toBe('ZZZZZZ');
    expect(JOIN_ALPHABET).toHaveLength(23);
  });

  it('normalizes user input', () => {
    expect(normalizeJoinCode(' abc def ')).toBe('ABCDEF');
    expect(normalizeJoinCode('abc-xyz')).toBe('ABCXYZ');
    expect(normalizeJoinCode('ABCDE')).toBeNull();
    expect(normalizeJoinCode('ABCDEI')).toBeNull(); // I is never used
  });

  it('avoids codes already taken', () => {
    let i = 0;
    const seq = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
    expect(uniqueJoinCode(new Set(['AAAAAA']), () => seq[i++])).toBe('BBBBBB');
    expect(() => uniqueJoinCode(new Set(['AAAAAA']), () => 0, 3)).toThrow();
  });
});

describe('channel ids', () => {
  it('are at least 32 url-safe characters', () => {
    const id = channelIdFromBytes(randomBytes(24));
    expect(id).toHaveLength(32);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(() => channelIdFromBytes(new Uint8Array(8))).toThrow();
  });
});
