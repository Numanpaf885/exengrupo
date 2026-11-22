import { describe, expect, it, vi } from 'vitest';
import type { PostRecord } from './schema';
import { openRouterCredits, usageStats } from './usage';

const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);
const post = (hoursAgo: number, status: string, answer: string, models: string): PostRecord => ({
  post_id: `p${hoursAgo}`,
  space_id: 's',
  user_id: 'u',
  photo_key: 'k',
  status,
  answer,
  models,
  created_at: new Date(NOW - hoursAgo * 3600_000).toISOString(),
  photo_expires_at: '',
});

describe('usageStats', () => {
  const posts = [
    post(1, 'done', '1.a', 'claude:opus-a, gemini:flash | by 1:claude+gemini | ref: libro.pdf p3'),
    post(5, 'done', '1.a', 'gemini:flash-old, groq:qwen | by 1:gemini+groq'),
    post(30, 'error', 'Límite de IA alcanzado, prueba en 5 min', ''),
    post(50, 'error', 'No se lee bien, repite la foto', 'groq:qwen'),
    post(24 * 10, 'done', '1.b', 'groq:llama'),
  ];
  const s = usageStats(posts, NOW);

  it('counts photos, errors, quota hits and reference use in 24 h / 7 days / total', () => {
    expect(s.photos).toEqual({ day: 2, week: 4, total: 5 });
    expect(s.errors).toEqual({ day: 0, week: 2, total: 2 });
    expect(s.quota).toEqual({ day: 0, week: 1, total: 1 });
    expect(s.unreadable).toEqual({ day: 0, week: 1, total: 1 });
    expect(s.with_references).toEqual({ day: 1, week: 1, total: 1 });
  });

  it('counts answers per provider with its latest model', () => {
    const by = Object.fromEntries(s.providers.map((p) => [p.id, p]));
    expect(by.claude).toMatchObject({ day: 1, week: 1, total: 1, model: 'opus-a' });
    expect(by.gemini).toMatchObject({ day: 2, week: 2, total: 2, model: 'flash' });
    expect(by.groq).toMatchObject({ day: 1, week: 2, total: 3, model: 'qwen' });
    expect(by.openrouter).toMatchObject({ total: 0, last_at: '' });
  });

  it('has 7 daily buckets ending today', () => {
    expect(s.daily).toHaveLength(7);
    expect(s.daily[6]).toEqual({ date: '2026-11-22', photos: 2 });
    expect(s.daily.reduce((n, d) => n + d.photos, 0)).toBe(4);
  });
});

describe('openRouterCredits', () => {
  it('reads usage and limit, and returns null on failure', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ data: { usage: 0.12, limit: null, is_free_tier: true } })));
    expect(await openRouterCredits('k', ok as unknown as typeof fetch)).toEqual({ usage: 0.12, limit: null, free_tier: true });
    const bad = vi.fn(async () => new Response('{}', { status: 401 }));
    expect(await openRouterCredits('k', bad as unknown as typeof fetch)).toBeNull();
  });
});
