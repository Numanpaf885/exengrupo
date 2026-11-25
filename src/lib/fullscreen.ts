/**
 * Native: nothing to do here; the space screen hides the status bar itself
 * (expo-status-bar `hidden`), and Android's back button leaves full screen mode.
 */
export function enterFullscreen(): void {}
export function exitFullscreen(): void {}
/** Calls `onExit` when the browser leaves full screen by itself (web only). */
export function onFullscreenExit(_onExit: () => void): () => void {
  return () => undefined;
}
