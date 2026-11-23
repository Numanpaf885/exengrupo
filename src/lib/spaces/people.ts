/** People picker helpers (create a space, add members, admin panel). */
export interface Person {
  user_id: string;
  username: string;
}

/** Case- and accent-insensitive match on the username; people in `exclude` are left out. */
export function filterPeople(list: Person[], query: string, exclude: ReadonlySet<string> = new Set()): Person[] {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  const q = fold(query);
  return list.filter((p) => !exclude.has(p.user_id) && (!q || fold(p.username).includes(q)));
}

/** Adds or removes one id (returns a new set). */
export function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** "Se añadirá a ana", "Se añadirán 3 personas", or "". */
export function pickedSummary(count: number, names: string[]): string {
  if (count === 0) return '';
  if (count === 1) return `Se añadirá a ${names[0]}.`;
  return `Se añadirán ${count} personas.`;
}
