/**
 * Web only (imported by the *.web.tsx cameras): turns the camera off whenever the camera screen is not in use — when it
 * unmounts, when another screen covers it, and when the tab or the home-screen
 * app goes to the background. Otherwise the phone's camera indicator stays on
 * until the tab is closed.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import type { CameraStreams } from './cameraStreams';

export function useReleaseCamera(streams: CameraStreams<MediaStream>, onReleased: () => void): void {
  // Leaving the screen (or another screen on top of it).
  useFocusEffect(
    useCallback(() => {
      streams.reopen();
      return () => {
        streams.close();
        onReleased();
      };
    }, [streams, onReleased]),
  );

  // Unmount, page hidden (app switcher, lock screen) or page being unloaded.
  useEffect(() => {
    const release = () => {
      streams.stopAll();
      onReleased();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') release();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', release);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', release);
      streams.close();
    };
  }, [streams, onReleased]);
}
