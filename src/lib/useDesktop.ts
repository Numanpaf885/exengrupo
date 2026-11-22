import { Platform, useWindowDimensions } from 'react-native';

/** Wider than a tablet in portrait: the web app switches to the desktop layout. */
export const DESKTOP_MIN_WIDTH = 900;
/** Content column widths on desktop. */
export const DESKTOP_COLUMN = 760;
export const DESKTOP_NARROW = 440;

/** True only in a desktop browser window; phones (app and web) always get the mobile layout. */
export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}
