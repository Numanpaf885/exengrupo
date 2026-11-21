/** Reads "try again in N seconds" from provider rate-limit responses. Pure, unit-tested. */

/** "30s", "1.5s", "2m30s", "1h" → seconds. */
export function parseDurationSeconds(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  let total = 0;
  let matched = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(ms|h|m|s)/g)) {
    matched = true;
    const v = Number(m[1]);
    total += m[2] === 'h' ? v * 3600 : m[2] === 'm' ? v * 60 : m[2] === 'ms' ? v / 1000 : v;
  }
  return matched ? total : undefined;
}

/** HTTP Retry-After: seconds or an HTTP date. */
export function retryAfterHeaderSeconds(value: string | null, nowMs: number): number | undefined {
  if (!value) return undefined;
  const secs = parseDurationSeconds(value);
  if (secs !== undefined) return secs;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, (date - nowMs) / 1000);
}

/** X-RateLimit-Reset as epoch milliseconds (OpenRouter style) or epoch seconds. */
export function resetHeaderSeconds(value: string | null, nowMs: number): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const n = Number(value);
  const ms = n > 1e12 ? n : n * 1000;
  return ms > nowMs ? (ms - nowMs) / 1000 : undefined;
}

/** Gemini 429 body: error.details[] with "@type": ".../google.rpc.RetryInfo", "retryDelay": "30s". */
export function geminiRetrySeconds(body: unknown): number | undefined {
  const details = (body as { error?: { details?: unknown[] } })?.error?.details;
  if (!Array.isArray(details)) return undefined;
  for (const d of details) {
    const rec = d as Record<string, unknown>;
    if (typeof rec['@type'] === 'string' && rec['@type'].endsWith('RetryInfo')) {
      return parseDurationSeconds(String(rec.retryDelay ?? ''));
    }
  }
  return undefined;
}

/** Minutes to show in "prueba en X min": rounded up, at least 1; 5 when unknown. */
export function retryMinutes(seconds: Array<number | undefined>): number {
  const known = seconds.filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
  if (known.length === 0) return 5;
  return Math.max(1, Math.ceil(Math.min(...known) / 60));
}
