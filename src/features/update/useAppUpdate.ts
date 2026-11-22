/**
 * Android: looks for a newer APK on GitHub Releases when the app opens and
 * whenever it comes back to the foreground (at most once an hour). Uses the
 * public GitHub API, no key and no extra service. Any failure just means "no
 * update shown".
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { type AvailableUpdate, currentBuild, newerRelease, RELEASES_API } from '@/lib/update/version';

const CHECK_EVERY_MS = 60 * 60 * 1000;
let lastCheck = 0;
let found: AvailableUpdate | null = null;
let dismissedBuild = 0;
const listeners = new Set<(u: AvailableUpdate | null) => void>();
const visible = () => (found && found.build !== dismissedBuild ? found : null);
const emit = () => listeners.forEach((l) => l(visible()));

async function check(): Promise<void> {
  const current = currentBuild();
  if (!current || Date.now() - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = Date.now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10_000);
  try {
    const res = await fetch(RELEASES_API, {
      headers: { accept: 'application/vnd.github+json' },
      signal: abort.signal,
    });
    if (!res.ok) return;
    found = newerRelease(await res.json(), current);
    emit();
  } catch {
    // offline or GitHub unavailable: try again next time
  } finally {
    clearTimeout(timer);
  }
}

/** The newer APK to offer, or null. */
export function useAppUpdate(): AvailableUpdate | null {
  const [update, setUpdate] = useState<AvailableUpdate | null>(visible);
  useEffect(() => {
    listeners.add(setUpdate);
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      listeners.delete(setUpdate);
      sub.remove();
    };
  }, []);
  return update;
}

/** "Más tarde": hide this build's banner until a newer one appears. */
export function dismissUpdate(build: number): void {
  dismissedBuild = build;
  emit();
}
