/**
 * Archived (hidden) spaces (user decision 2026-11-28). Stored in the "ajustes"
 * tab as `archived_spaces` = comma-separated space_ids, so the fixed spaces tab
 * is untouched. Changed 2026-11-28: every member still sees and opens it, but
 * under "Espacios archivados" (home → Más) instead of the main list; its join
 * code stops working. Its creator, the owner (numan) or the admin bring it back.
 */
import type { DataDeps } from './context';

export const ARCHIVE_KEY = 'archived_spaces';

export function archivedIds(settings: Record<string, string>): Set<string> {
  return new Set(
    (settings[ARCHIVE_KEY] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function archivedSpaces(deps: DataDeps): Promise<Set<string>> {
  return archivedIds(await deps.settings.getAll());
}

export async function setArchived(deps: DataDeps, spaceId: string, archived: boolean): Promise<void> {
  const ids = await archivedSpaces(deps);
  if (archived === ids.has(spaceId)) return;
  if (archived) ids.add(spaceId);
  else ids.delete(spaceId);
  await deps.settings.set(ARCHIVE_KEY, [...ids].join(','), new Date(deps.now()).toISOString());
}

/** Body { archived: boolean } → the boolean, or null when malformed. */
export function archivedFlag(body: unknown): boolean | null {
  const v = body && typeof body === 'object' ? (body as Record<string, unknown>).archived : undefined;
  return typeof v === 'boolean' ? v : null;
}
