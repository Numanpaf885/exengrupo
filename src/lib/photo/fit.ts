/** Photo size rules: long edge ≤ 2000 px, JPEG, under 3 MB. Pure, unit-tested. */
export const MAX_EDGE = 2000;
export const MAX_BYTES = 3 * 1024 * 1024;
/** JPEG qualities tried in order until the file is small enough. */
export const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.5, 0.4];

/** Target size keeping aspect ratio, or null if the image already fits. */
export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (long <= max || long <= 0) return null;
  const scale = max / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Bytes of the data in a base64 string (used to measure each JPEG try). */
export function base64Bytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
