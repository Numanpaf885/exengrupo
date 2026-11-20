/**
 * Reads the lens from a photo's EXIF data. Used for photos taken with the
 * phone's own camera app, where we cannot know which lens the user chose.
 */

/** Ultra-wide lenses are ~13–16 mm (35 mm equivalent); main lenses ~24–28 mm. */
export const ULTRA_WIDE_MAX_35MM = 20;

/** EXIF numbers may arrive as numbers, "5.43" or rationals like "543/100". */
export function exifNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  const rational = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s);
  const n = rational ? Number(rational[1]) / Number(rational[2]) : Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export interface ExifLens {
  /** 35 mm-equivalent focal length, if the camera wrote it. */
  focal35?: number;
  /** Real focal length in mm, if present. */
  focalMm?: number;
  /** true = ultra-wide, false = not ultra-wide, null = cannot tell. */
  is05: boolean | null;
}

export function lensFromExif(exif: Record<string, unknown> | null | undefined): ExifLens {
  const focal35 = exifNumber(exif?.FocalLengthIn35mmFilm);
  const focalMm = exifNumber(exif?.FocalLength);
  return {
    focal35,
    focalMm,
    is05: focal35 === undefined ? null : focal35 < ULTRA_WIDE_MAX_35MM,
  };
}

/** "14 mm (equiv. 35 mm) · 1,7 mm reales" */
export function formatFocal({ focal35, focalMm }: ExifLens): string {
  const parts: string[] = [];
  if (focal35 !== undefined) parts.push(`${Math.round(focal35)} mm (equiv. 35 mm)`);
  if (focalMm !== undefined) parts.push(`${focalMm.toFixed(1).replace('.', ',')} mm reales`);
  return parts.length > 0 ? parts.join(' · ') : 'sin datos';
}
