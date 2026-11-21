import { describe, expect, it } from 'vitest';
import { formatPostTime } from './time';

describe('formatPostTime', () => {
  const now = new Date(2026, 10, 21, 18, 0);
  it('shows only the time for today', () => {
    expect(formatPostTime(new Date(2026, 10, 21, 9, 5).toISOString(), now)).toBe('09:05');
  });
  it('adds the day for older posts', () => {
    expect(formatPostTime(new Date(2026, 10, 20, 23, 59).toISOString(), now)).toBe('20 nov 23:59');
  });
  it('is empty for bad input', () => {
    expect(formatPostTime('nope', now)).toBe('');
  });
});
