/**
 * Android update check (pure, unit-tested). Every APK built by GitHub Actions
 * gets the run number as its build number (versionCode and
 * EXPO_PUBLIC_BUILD_NUMBER); every build on main is published as a GitHub
 * Release "build-<run number>" with exengrupo.apk attached.
 */
export const RELEASES_API = 'https://api.github.com/repos/Numanpaf885/exengrupo/releases/latest';

/** The build number this APK was made from; 0 for local/dev builds (never prompts). */
export function currentBuild(raw: string | undefined = process.env.EXPO_PUBLIC_BUILD_NUMBER): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** "build-34" → 34; anything else → null. */
export function buildFromTag(tag: unknown): number | null {
  const m = typeof tag === 'string' ? /^build-(\d+)$/.exec(tag.trim()) : null;
  return m ? Number(m[1]) : null;
}

export interface AvailableUpdate {
  build: number;
  /** Direct download of the APK. */
  url: string;
}

/** The newer APK in a GitHub "latest release" reply, or null when this one is current. */
export function newerRelease(release: unknown, current: number): AvailableUpdate | null {
  if (!current || !release || typeof release !== 'object') return null;
  const r = release as { tag_name?: unknown; draft?: unknown; prerelease?: unknown; assets?: unknown };
  if (r.draft || r.prerelease) return null;
  const build = buildFromTag(r.tag_name);
  if (build === null || build <= current) return null;
  const assets = Array.isArray(r.assets) ? (r.assets as Array<{ name?: unknown; browser_download_url?: unknown }>) : [];
  const apk = assets.find((a) => typeof a.name === 'string' && a.name.endsWith('.apk'));
  if (!apk || typeof apk.browser_download_url !== 'string' || !apk.browser_download_url.startsWith('https://')) return null;
  return { build, url: apk.browser_download_url };
}
