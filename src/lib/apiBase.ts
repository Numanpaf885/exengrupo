/** Where /api lives. The web build calls its own origin (so Vercel previews work);
 *  the Android app calls the production URL from EXPO_PUBLIC_API_URL. */
export const DEFAULT_API_URL = 'https://exengrupo.vercel.app';

export function apiBase(platform: string, envUrl: string | undefined): string {
  if (platform === 'web') return '';
  return (envUrl || DEFAULT_API_URL).replace(/\/+$/, '');
}
