import { describe, expect, it } from 'vitest';
import type { PostView } from '@/lib/photo/upload';
import { upsertPost } from './feed';

const p = (id: string, at: string, status = 'done'): PostView => ({
  post_id: id,
  user_id: 'u',
  username: 'ana',
  status,
  answer: '',
  created_at: at,
});

describe('upsertPost', () => {
  it('puts a new post at the top', () => {
    expect(upsertPost([p('a', '2026-11-21T10:00')], p('b', '2026-11-21T11:00')).map((x) => x.post_id)).toEqual(['b', 'a']);
  });
  it('replaces an existing post in place (processing → done)', () => {
    const feed = [p('b', '2026-11-21T11:00', 'processing'), p('a', '2026-11-21T10:00')];
    const next = upsertPost(feed, p('b', '2026-11-21T11:00', 'done'));
    expect(next.map((x) => `${x.post_id}:${x.status}`)).toEqual(['b:done', 'a:done']);
  });
});
