/**
 * Pure lens-selection logic for Android (react-native-vision-camera v5).
 * Works on a minimal shape so it can be unit-tested without native code.
 */

export type NativeDeviceType =
  | 'wide-angle'
  | 'ultra-wide-angle'
  | 'telephoto'
  | 'dual'
  | 'dual-wide'
  | 'triple'
  | 'quad'
  | 'continuity'
  | 'lidar-depth'
  | 'true-depth'
  | 'time-of-flight-depth'
  | 'external'
  | 'unknown';

export interface NativeLensInfo {
  id: string;
  localizedName: string;
  type: NativeDeviceType;
  position: string;
  isVirtualDevice: boolean;
  physicalDevices: { id: string; localizedName: string; type: NativeDeviceType }[];
  minZoom: number;
  maxZoom: number;
  zoomLensSwitchFactors: number[];
}

export type NativePickReason =
  /** A physical ultra-wide camera is exposed on its own. */
  | 'ultra-wide-physical'
  /** A logical multi-camera whose minimum zoom is below 1 (that is, 0.5x). */
  | 'multi-camera-min-zoom'
  /** A virtual camera that contains an ultra-wide physical camera. */
  | 'virtual-with-ultra-wide'
  /** No ultra-wide: the widest back camera we could find. */
  | 'widest-available';

export interface NativePick<T extends NativeLensInfo = NativeLensInfo> {
  device: T;
  /** Zoom value to open the camera with (its widest view). */
  zoom: number;
  reason: NativePickReason;
  /** True when the camera really opens at 0.5x (ultra-wide). */
  is05: boolean;
}

const hasUltraWide = (d: NativeLensInfo): boolean =>
  d.physicalDevices.some((p) => p.type === 'ultra-wide-angle');

/**
 * The "neutral" (1x) zoom of a device. VisionCamera v5 no longer exposes
 * `neutralZoom`, so it is derived:
 * - min zoom below 1 (Android logical camera): 1x is zoom 1;
 * - virtual camera that starts on the ultra-wide: the first lens-switch factor;
 * - otherwise the device's minimum zoom.
 */
export function neutralZoom(d: NativeLensInfo): number {
  if (d.minZoom < 1) return Math.min(1, d.maxZoom);
  if (d.isVirtualDevice && hasUltraWide(d) && d.zoomLensSwitchFactors.length > 0) {
    return d.zoomLensSwitchFactors[0];
  }
  return d.minZoom;
}

export function backDevices<T extends NativeLensInfo>(devices: T[]): T[] {
  return devices.filter((d) => d.position === 'back');
}

/** Choose the camera that opens at 0.5x, or the widest one if none can. */
export function pickNativeLens<T extends NativeLensInfo>(devices: T[]): NativePick<T> | undefined {
  const back = backDevices(devices);
  if (back.length === 0) return undefined;

  const physicalUltraWide = back.find((d) => !d.isVirtualDevice && d.type === 'ultra-wide-angle');
  if (physicalUltraWide) {
    return {
      device: physicalUltraWide,
      zoom: physicalUltraWide.minZoom,
      reason: 'ultra-wide-physical',
      is05: true,
    };
  }

  const belowOne = back
    .filter((d) => d.minZoom < 1)
    .sort((a, b) => a.minZoom - b.minZoom)[0];
  if (belowOne) {
    return { device: belowOne, zoom: belowOne.minZoom, reason: 'multi-camera-min-zoom', is05: true };
  }

  const virtualUltraWide = back.find((d) => d.isVirtualDevice && hasUltraWide(d));
  if (virtualUltraWide) {
    return {
      device: virtualUltraWide,
      zoom: virtualUltraWide.minZoom,
      reason: 'virtual-with-ultra-wide',
      is05: true,
    };
  }

  // No ultra-wide anywhere: prefer the plain wide-angle, then anything else.
  const widest = back.find((d) => d.type === 'wide-angle') ?? back[0];
  return { device: widest, zoom: widest.minZoom, reason: 'widest-available', is05: false };
}

export const NATIVE_REASON_LABEL: Record<NativePickReason, string> = {
  'ultra-wide-physical': 'cámara ultra gran angular física',
  'multi-camera-min-zoom': 'multicámara con zoom mínimo',
  'virtual-with-ultra-wide': 'cámara virtual con ultra gran angular',
  'widest-available': 'cámara más amplia disponible',
};
