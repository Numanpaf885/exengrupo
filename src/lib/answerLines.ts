/**
 * Splits the saved answer line ("1.a  2.b/c ?  3. El agua hierve a 100 °C.")
 * into one item per question so the app can show each answer on its own line.
 * Returns null for anything that isn't an answer line (e.g. an error message).
 */
export interface AnswerItem {
  n: number;
  /** "a", "V", "b/c" or the open sentence (without the trailing " ?"). */
  text: string;
  /** The two AIs disagreed ("b/c ?"). */
  unsure: boolean;
}

export function parseAnswerLine(line: string): AnswerItem[] | null {
  const parts = line.trim().split(/\s{2,}/).filter(Boolean);
  if (parts.length === 0) return null;
  const items: AnswerItem[] = [];
  for (const part of parts) {
    const m = /^(\d{1,3})\.\s?(.+)$/.exec(part);
    if (!m) return null;
    const unsure = /\s\?$/.test(m[2]);
    items.push({ n: Number(m[1]), text: unsure ? m[2].replace(/\s\?$/, '') : m[2], unsure });
  }
  return items;
}
