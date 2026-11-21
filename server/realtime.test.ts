import { describe, expect, it, vi } from 'vitest';
import { planHeartbeat, supabaseBroadcaster, touchHeartbeat } from './realtime';

describe('supabaseBroadcaster', () => {
  it('posts only {post_id} to the topic with the key on apikey', async () => {
    const fetchMock = vi.fn(async (_u: string, _i?: RequestInit) => new Response(null, { status: 202 }));
    await supabaseBroadcaster('https://abc.supabase.co/', 'sb_secret_test', fetchMock)('chan_123', 'post-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc.supabase.co/realtime/v1/api/broadcast/chan_123/events/post');
    const headers = init?.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_test');
    expect(headers.authorization).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toEqual({ post_id: 'post-1' });
  });

  it('throws on failure (callers decide whether it matters)', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    await expect(supabaseBroadcaster('https://x', 'k', fetchMock)('c', 'p')).rejects.toThrow(/401/);
  });
});

describe('heartbeat', () => {
  it('plans an update of the timestamp column filtered by id', () => {
    expect(planHeartbeat({ id: 1, last_ping: '2026-01-01' }, 'NOW')).toEqual({
      filter: 'id=eq.1',
      patch: { last_ping: 'NOW' },
    });
    expect(planHeartbeat({ key: 'x', updated: 'y' }, 'NOW')).toEqual({ filter: 'key=eq.x', patch: { updated: 'NOW' } });
    expect(planHeartbeat({ id: 7 }, 'NOW')).toEqual({ filter: 'id=eq.7', patch: { id: 7 } });
    expect(planHeartbeat({ id: 2, created_at: 'a', ts: 'b' }, 'NOW')).toEqual({ filter: 'id=eq.2', patch: { id: 2 } });
    expect(planHeartbeat({ id: 3, created_at: 'a', checked_at: 'b' }, 'NOW')?.patch).toEqual({ checked_at: 'NOW' });
    expect(planHeartbeat({}, 'NOW')).toBeNull();
  });

  it('reads the row, then PATCHes it', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify([{ id: 1, created_at: 'x', last_beat: 'y' }]), { status: 200 }),
    );
    expect(await touchHeartbeat('https://abc.supabase.co', 'sb_secret_test', 'NOW', fetchMock)).toEqual({
      column: 'last_beat',
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://abc.supabase.co/rest/v1/heartbeat?id=eq.1');
    expect((init?.headers as Record<string, string>).apikey).toBe('sb_secret_test');
    expect(JSON.parse(String(init?.body))).toEqual({ last_beat: 'NOW' });
  });
});
