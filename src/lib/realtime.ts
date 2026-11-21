/**
 * Live updates: Supabase Realtime Broadcast on the space's random channel_id.
 * The server sends only { post_id }; the app then fetches the post from /api.
 * Public channel + publishable key; no Supabase Auth, no tables.
 */
import { RealtimeClient } from '@supabase/realtime-js';
import { realtimeConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export const NEW_POST_EVENT = 'post';

let client: RealtimeClient | null = null;

function getClient(): RealtimeClient | null {
  if (!realtimeConfigured) return null;
  if (!client) {
    client = new RealtimeClient(`${SUPABASE_URL.replace(/\/+$/, '')}/realtime/v1`, {
      params: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
  }
  return client;
}

/** Listens for new/updated posts in one space. Returns an unsubscribe function. */
export function subscribeToSpace(channelId: string, onPostId: (postId: string) => void): () => void {
  try {
    const c = getClient();
    if (!c || !channelId) return () => undefined;
    const channel = c
      .channel(channelId, { config: { private: false } })
      .on('broadcast', { event: NEW_POST_EVENT }, (message) => {
        const postId = (message.payload as { post_id?: unknown } | undefined)?.post_id;
        if (typeof postId === 'string') onPostId(postId);
      })
      .subscribe();
    return () => {
      void c.removeChannel(channel).catch(() => undefined);
    };
  } catch {
    // Live updates are a bonus: the feed still refreshes on focus and with "Actualizar".
    return () => undefined;
  }
}
