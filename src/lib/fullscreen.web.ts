/**
 * Web: the browser's Fullscreen API where it exists (Android Chrome, desktop).
 * iPhone Safari has none for pages, but the home-screen web app already fills
 * the screen, so there the app's own full screen layout is enough.
 */
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

const current = () => (document as FsDoc).fullscreenElement ?? (document as FsDoc).webkitFullscreenElement ?? null;

export function enterFullscreen(): void {
  try {
    const el = document.documentElement as FsEl;
    if (current()) return;
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    else el.webkitRequestFullscreen?.();
  } catch {
    // not allowed here: the in-app full screen layout still applies
  }
}

export function exitFullscreen(): void {
  try {
    if (!current()) return;
    const d = document as FsDoc;
    if (d.exitFullscreen) void d.exitFullscreen().catch(() => undefined);
    else d.webkitExitFullscreen?.();
  } catch {
    // ignore
  }
}

/** Calls `onExit` when the browser leaves full screen by itself (Esc, back gesture). */
export function onFullscreenExit(onExit: () => void): () => void {
  const handler = () => {
    if (!current()) onExit();
  };
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
