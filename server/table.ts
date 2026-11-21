/**
 * A tiny table abstraction over one Sheet tab, so the handlers can be tested
 * with an in-memory table. Values are always strings (the Sheet stores RAW text).
 */
import type { SheetsClient } from './sheets';

export type Row = Record<string, string>;

export interface Table<T extends Row> {
  list(): Promise<Array<{ rowNumber: number; value: T }>>;
  append(value: T): Promise<void>;
  update(rowNumber: number, patch: Partial<T>): Promise<void>;
}

/** Sheet booleans: we write "TRUE"/"FALSE"; a ticked checkbox also reads as TRUE. */
export const isTrue = (v: string | undefined): boolean => (v ?? '').trim().toUpperCase() === 'TRUE';
export const TRUE = 'TRUE';
export const FALSE = 'FALSE';

export function sheetsTable<T extends Row>(client: SheetsClient, tab: string): Table<T> {
  let headers: string[] | null = null;
  const ensureHeaders = async () => {
    if (!headers) headers = (await client.readTable(tab)).headers;
    return headers;
  };
  return {
    async list() {
      const table = await client.readTable(tab);
      headers = table.headers;
      return table.records.map((r) => ({ rowNumber: r.rowNumber, value: r.values as T }));
    },
    async append(value) {
      await client.appendRecord(tab, await ensureHeaders(), value);
    },
    async update(rowNumber, patch) {
      await client.updateCells(tab, await ensureHeaders(), rowNumber, patch as Row);
    },
  };
}

/** In-memory table used by unit tests. Row numbers start at 2 like the Sheet. */
export function memoryTable<T extends Row>(initial: T[] = []): Table<T> & { rows: T[] } {
  const rows = [...initial];
  return {
    rows,
    async list() {
      return rows.map((value, i) => ({ rowNumber: i + 2, value: { ...value } }));
    },
    async append(value) {
      rows.push({ ...value });
    },
    async update(rowNumber, patch) {
      const i = rowNumber - 2;
      if (!rows[i]) throw new Error(`No row ${rowNumber}`);
      rows[i] = { ...rows[i], ...patch } as T;
    },
  };
}
