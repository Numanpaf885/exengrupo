/** Formatting helpers for the lens test screen (Spanish UI). */

const nf1 = (n: number): string => n.toFixed(1).replace('.', ',');

/** "4032 × 3024 px · 12,2 MP" */
export function formatResolution(width: number, height: number): string {
  const mp = (width * height) / 1_000_000;
  return `${width} × ${height} px · ${nf1(mp)} MP`;
}

/** "0,5x" — zoom values with a Spanish decimal comma, trailing zeros trimmed. */
export function formatZoom(zoom: number): string {
  const rounded = Math.round(zoom * 100) / 100;
  return `${String(rounded).replace('.', ',')}x`;
}

export function format05(is05: boolean): string {
  return is05 ? '0.5x: sí' : '0.5x: no';
}
