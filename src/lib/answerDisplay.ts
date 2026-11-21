/**
 * Display-only tweak of the saved answer line: keep "3.b/c ?" together on one
 * line (non-breaking space before "?"). The saved text keeps the exact format.
 */
export function displayAnswer(line: string): string {
  return line.replace(/ \?/g, ' ?');
}
