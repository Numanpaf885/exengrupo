import { describe, expect, it } from 'vitest';
import { normalizeUsername, passwordError, usernameError } from './validation';

describe('usernames', () => {
  it('normalizes to trimmed lowercase', () => {
    expect(normalizeUsername('  Ana.Perez ')).toBe('ana.perez');
  });

  it('accepts valid usernames', () => {
    expect(usernameError('Ana_99')).toBeNull();
    expect(usernameError('a.b-c')).toBeNull();
  });

  it('rejects bad lengths and characters', () => {
    expect(usernameError('ab')).toMatch(/entre 3 y 20/);
    expect(usernameError('a'.repeat(21))).toMatch(/entre 3 y 20/);
    expect(usernameError('josé')).toMatch(/solo puede/);
    expect(usernameError('ana perez')).toMatch(/solo puede/);
    expect(usernameError('=SUM(A1)')).toMatch(/solo puede/);
  });
});

describe('passwords', () => {
  it('needs at least 8 characters', () => {
    expect(passwordError('1234567')).toMatch(/al menos 8/);
    expect(passwordError('12345678')).toBeNull();
  });

  it('rejects passwords over 72 UTF-8 bytes', () => {
    expect(passwordError('a'.repeat(72))).toBeNull();
    expect(passwordError('a'.repeat(73))).toMatch(/demasiado larga/);
    expect(passwordError('ñ'.repeat(37))).toMatch(/demasiado larga/); // 74 bytes
  });
});
