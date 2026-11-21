/** Space name rules, shared by the screens and the server. */
export const SPACE_NAME_MAX = 40;

export function normalizeSpaceName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function spaceNameError(raw: string): string | null {
  const name = normalizeSpaceName(raw);
  if (name.length === 0) return 'Escribe un nombre para el espacio.';
  if (name.length > SPACE_NAME_MAX) return `El nombre puede tener como máximo ${SPACE_NAME_MAX} caracteres.`;
  return null;
}
