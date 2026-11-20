import { describe, expect, it } from 'vitest';
import { apiBase } from './apiBase';

describe('apiBase', () => {
  it('uses the same origin on web', () => {
    expect(apiBase('web', 'https://exengrupo.vercel.app')).toBe('');
  });

  it('uses EXPO_PUBLIC_API_URL on Android, without a trailing slash', () => {
    expect(apiBase('android', 'https://example.test/')).toBe('https://example.test');
  });

  it('falls back to production', () => {
    expect(apiBase('android', undefined)).toBe('https://exengrupo.vercel.app');
    expect(apiBase('android', '')).toBe('https://exengrupo.vercel.app');
  });
});
