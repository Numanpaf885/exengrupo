import { describe, expect, it } from 'vitest';
import {
  geminiRetrySeconds,
  parseDurationSeconds,
  resetHeaderSeconds,
  retryAfterHeaderSeconds,
  retryMinutes,
} from './retry';

const NOW = Date.UTC(2026, 10, 21, 10, 0, 0);

describe('retry parsing', () => {
  it('parses durations', () => {
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('1.5s')).toBe(1.5);
    expect(parseDurationSeconds('2m30s')).toBe(150);
    expect(parseDurationSeconds('7')).toBe(7);
    expect(parseDurationSeconds('soon')).toBeUndefined();
  });

  it('reads Retry-After as seconds or a date', () => {
    expect(retryAfterHeaderSeconds('42', NOW)).toBe(42);
    expect(retryAfterHeaderSeconds(new Date(NOW + 90_000).toUTCString(), NOW)).toBe(90);
    expect(retryAfterHeaderSeconds(null, NOW)).toBeUndefined();
  });

  it('reads X-RateLimit-Reset in ms or s', () => {
    expect(resetHeaderSeconds(String(NOW + 120_000), NOW)).toBe(120);
    expect(resetHeaderSeconds(String(NOW / 1000 + 60), NOW)).toBe(60);
    expect(resetHeaderSeconds(String(NOW - 1), NOW)).toBeUndefined();
  });

  it('reads Gemini RetryInfo', () => {
    const body = {
      error: {
        code: 429,
        details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure' },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' },
        ],
      },
    };
    expect(geminiRetrySeconds(body)).toBe(37);
    expect(geminiRetrySeconds({})).toBeUndefined();
  });

  it('turns seconds into the minutes shown to the user', () => {
    expect(retryMinutes([37, 200])).toBe(1);
    expect(retryMinutes([undefined, 125])).toBe(3);
    expect(retryMinutes([undefined])).toBe(5);
    expect(retryMinutes([])).toBe(5);
  });
});
