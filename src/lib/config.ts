/**
 * Public client config, inlined at build time (EXPO_PUBLIC_*). These two
 * Supabase values are public by design (publishable key). Without them the app
 * still works, just without live updates.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const realtimeConfigured = SUPABASE_URL.startsWith('https://') && SUPABASE_PUBLISHABLE_KEY.length > 0;

/** Where join links point (the iPhone/web app). */
export const WEB_URL = 'https://exengrupo.vercel.app';
