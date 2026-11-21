/**
 * Offline indicator shared by every screen. Any /api call that can't reach the
 * server marks the app offline; the next successful call marks it online.
 * On web, the browser's online/offline events are used as well.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

let offline = false;
const listeners = new Set<() => void>();

export function setOffline(value: boolean): void {
  if (offline === value) return;
  offline = value;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('offline', () => setOffline(true));
  window.addEventListener('online', () => setOffline(false));
  if (typeof navigator !== 'undefined' && navigator.onLine === false) offline = true;
}

export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, () => offline);
}
