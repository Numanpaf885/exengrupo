import type { PostView } from '@/lib/photo/upload';

/** Insert or replace a post, keeping the feed newest-first. Pure, unit-tested. */
export function upsertPost(posts: PostView[], post: PostView): PostView[] {
  const rest = posts.filter((p) => p.post_id !== post.post_id);
  return [post, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
