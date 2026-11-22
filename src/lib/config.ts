/**
 * Public client config, inlined at build time (EXPO_PUBLIC_*). These two
 * Supabase values are public by design (publishable key). Without them the app
 * still works, just without live updates.
 */
// Public by design (publishable key, safe to commit); env vars override them.
const DEFAULT_SUPABASE_URL = 'https://ocaeanegpyqjhudhloip.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_SKmf_g2iDxJbiZ2HJWERjw_-qxApl7x';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
export const realtimeConfigured = SUPABASE_URL.startsWith('https://') && SUPABASE_PUBLISHABLE_KEY.length > 0;

/** Where join links point (the iPhone/web app). */
export const WEB_URL = 'https://exengrupo.vercel.app';
