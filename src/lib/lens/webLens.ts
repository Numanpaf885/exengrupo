/**
 * Pure lens-selection logic for the web build (iPhone Safari PWA).
 * Labels come from navigator.mediaDevices.enumerateDevices() and are only
 * filled in after camera permission has been granted.
 */

export interface WebCamera {
  deviceId: string;
  label: string;
}

export type WebLensKind = 'ultra-wide' | 'virtual-wide' | 'default';

export interface WebPick<T extends WebCamera = WebCamera> {
  device: T;
  kind: WebLensKind;
  /** True only when an ultra-wide camera was found by its label. */
  is05: boolean;
}

/** Lowercase and strip accents so "Cámara" matches "camara". */
export function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// English iOS: "Back Ultra Wide Camera". Spanish iOS: "Cámara ultra gran angular (posterior)".
const ULTRA_WIDE = /ultra[ -]?wide|ultra[ -]?gran[ -]?angular|ultra[ -]?angular|ultragran/;
// English iOS: "Back Dual Wide Camera", "Back Triple Camera".
// Spanish iOS: "Cámara gran angular dual", "Cámara doble gran angular", "Cámara triple".
const VIRTUAL_WIDE =
  /dual[ -]?wide|triple|doble gran angular|dual gran angular|gran angular dual|gran angular doble/;
const FRONT = /front|frontal|delantera|facetime/;
const BACK = /back|rear|environment|trasera|posterior/;

export function isUltraWideLabel(label: string): boolean {
  return ULTRA_WIDE.test(normalizeLabel(label));
}

export function isVirtualWideLabel(label: string): boolean {
  const n = normalizeLabel(label);
  return !ULTRA_WIDE.test(n) && VIRTUAL_WIDE.test(n);
}

export function isFrontLabel(label: string): boolean {
  return FRONT.test(normalizeLabel(label));
}

export function isBackLabel(label: string): boolean {
  const n = normalizeLabel(label);
  return !FRONT.test(n) && BACK.test(n);
}

/**
 * Back cameras. If no label says front or back (e.g. a laptop webcam), every
 * non-front camera is returned so the screen is still testable on a desktop.
 */
export function webBackCameras<T extends WebCamera>(cams: T[]): T[] {
  const back = cams.filter((c) => isBackLabel(c.label));
  if (back.length > 0) return back;
  return cams.filter((c) => !isFrontLabel(c.label));
}

/**
 * Pick, in order: ultra-wide by label → virtual dual-wide/triple → default back camera.
 * `defaultDeviceId` is the camera Safari gave us for facingMode "environment".
 */
export function pickWebLens<T extends WebCamera>(
  cams: T[],
  defaultDeviceId?: string,
): WebPick<T> | undefined {
  const back = webBackCameras(cams);
  const ultra = back.find((c) => isUltraWideLabel(c.label));
  if (ultra) return { device: ultra, kind: 'ultra-wide', is05: true };

  const virtual = back.find((c) => isVirtualWideLabel(c.label));
  if (virtual) return { device: virtual, kind: 'virtual-wide', is05: false };

  const fallback = back.find((c) => c.deviceId === defaultDeviceId) ?? back[0] ?? cams[0];
  if (!fallback) return undefined;
  return { device: fallback, kind: 'default', is05: false };
}

export const WEB_KIND_LABEL: Record<WebLensKind, string> = {
  'ultra-wide': 'ultra gran angular',
  'virtual-wide': 'cámara virtual (dual/triple) al zoom mínimo',
  default: 'cámara trasera predeterminada',
};
