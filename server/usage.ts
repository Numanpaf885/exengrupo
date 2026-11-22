/**
 * AI usage for the admin panel, counted from the posts tab (no extra service):
 * photos, errors and quota hits in the last 24 h / 7 days / all time, and how
 * many answers each provider gave. OpenRouter is the only provider with a free
 * key-info endpoint, so its credit use is added when it has a key.
 */
import { PROVIDER_IDS, type ProviderId } from './ai/config';
import { modelProviders } from './ai/sources';
import type { PostRecord } from './schema';

const DAY = 24 * 60 * 60 * 1000;

export interface Window {
  day: number;
  week: number;
  total: number;
}

export interface ProviderUsage extends Window {
  id: ProviderId;
  /** Most recent model ID this provider answered with. */
  model: string;
  last_at: string;
  /** Photos where this AI was tried and failed (error, rate limit, bad reply). */
  failed: Window;
  /** Why it failed the last time, e.g. "HTTP 404" or "rate limited". */
  last_error: string;
  last_error_at: string;
}

/** "fail gemini=HTTP 404; groq=rate limited" segment of posts.models → [provider, reason]. */
export function parseFailures(models: string): Array<[string, string]> {
  const segment = models.split(' | ').find((s) => s.startsWith('fail '));
  if (!segment) return [];
  return segment
    .slice(5)
    .split('; ')
    .map((item) => {
      const i = item.indexOf('=');
      return (i > 0 ? [item.slice(0, i), item.slice(i + 1)] : [item, '']) as [string, string];
    });
}

export interface UsageStats {
  photos: Window;
  errors: Window;
  quota: Window;
  unreadable: Window;
  with_references: Window;
  providers: ProviderUsage[];
  /** Photos per day for the last 7 days, oldest first (UTC days). */
  daily: Array<{ date: string; photos: number }>;
}

const empty = (): Window => ({ day: 0, week: 0, total: 0 });

function add(w: Window, age: number) {
  w.total++;
  if (age < 7 * DAY) w.week++;
  if (age < DAY) w.day++;
}

export function usageStats(posts: PostRecord[], now: number): UsageStats {
  const stats: UsageStats = {
    photos: empty(),
    errors: empty(),
    quota: empty(),
    unreadable: empty(),
    with_references: empty(),
    providers: PROVIDER_IDS.map((id) => ({ id, ...empty(), model: '', last_at: '', failed: empty(), last_error: '', last_error_at: '' })),
    daily: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(now - (6 - i) * DAY).toISOString().slice(0, 10),
      photos: 0,
    })),
  };
  for (const p of posts) {
    const at = Date.parse(p.created_at);
    if (Number.isNaN(at)) continue;
    const age = now - at;
    add(stats.photos, age);
    const day = stats.daily.find((d) => d.date === p.created_at.slice(0, 10));
    if (day) day.photos++;
    if (p.status === 'error') {
      add(stats.errors, age);
      if (p.answer.startsWith('Límite de IA')) add(stats.quota, age);
      if (p.answer.startsWith('No se lee bien')) add(stats.unreadable, age);
    }
    if (p.models.includes(' | ref: ')) add(stats.with_references, age);
    for (const [id, reason] of parseFailures(p.models)) {
      const prov = stats.providers.find((x) => x.id === id);
      if (!prov) continue;
      add(prov.failed, age);
      if (!prov.last_error_at || p.created_at > prov.last_error_at) {
        prov.last_error = reason;
        prov.last_error_at = p.created_at;
      }
    }
    const first = p.models.split(' | ')[0] ?? '';
    if (first.startsWith('fail ')) continue;
    for (const id of modelProviders(p.models)) {
      const prov = stats.providers.find((x) => x.id === id);
      if (!prov) continue;
      add(prov, age);
      if (!prov.last_at || p.created_at > prov.last_at) {
        prov.last_at = p.created_at;
        prov.model = first.split(',').map((s) => s.trim()).find((s) => s.startsWith(`${id}:`))?.slice(id.length + 1) ?? '';
      }
    }
  }
  return stats;
}

export interface OpenRouterCredits {
  /** Credits used (USD) by this key, and its limit (null = no limit). */
  usage: number;
  limit: number | null;
  free_tier: boolean;
}

/** GET https://openrouter.ai/api/v1/key — free, uses no tokens. Null on any failure. */
export async function openRouterCredits(key: string, fetchImpl: typeof fetch = fetch): Promise<OpenRouterCredits | null> {
  try {
    const res = await fetchImpl('https://openrouter.ai/api/v1/key', {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { usage?: number; limit?: number | null; is_free_tier?: boolean } };
    const d = body.data ?? {};
    return { usage: Number(d.usage ?? 0), limit: d.limit ?? null, free_tier: !!d.is_free_tier };
  } catch {
    return null;
  }
}
