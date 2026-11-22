/**
 * Admin settings (AI keys and model IDs) in the Sheet tab "ajustes"
 * (clave | valor | actualizado). The tab is created on the first save; until
 * then everything falls back to the Vercel env vars. API keys are stored
 * encrypted (server/secretbox.ts).
 */
import type { SheetsClient } from './sheets';

export const SETTINGS_TAB = 'ajustes';
export const SETTINGS_HEADERS = ['clave', 'valor', 'actualizado'];

export interface SettingsStore {
  getAll(): Promise<Record<string, string>>;
  set(key: string, value: string, at: string): Promise<void>;
}

const CACHE_MS = 30_000;

export function sheetsSettings(client: SheetsClient, now: () => number = Date.now): SettingsStore {
  let cache: { at: number; values: Record<string, string> } | null = null;
  let tabExists: boolean | null = null;

  const exists = async () => {
    if (tabExists !== true) tabExists = (await client.listTabs()).includes(SETTINGS_TAB);
    return tabExists;
  };

  const read = async () => {
    if (!(await exists())) return { headers: SETTINGS_HEADERS, rows: [] as Array<{ rowNumber: number; key: string }>, values: {} };
    const table = await client.readTable(SETTINGS_TAB);
    const values: Record<string, string> = {};
    const rows = table.records.map((r) => {
      values[r.values.clave] = r.values.valor ?? '';
      return { rowNumber: r.rowNumber, key: r.values.clave };
    });
    return { headers: table.headers, rows, values };
  };

  return {
    async getAll() {
      if (cache && now() - cache.at < CACHE_MS) return cache.values;
      const { values } = await read();
      cache = { at: now(), values };
      return values;
    },
    async set(key, value, at) {
      if (!(await exists())) {
        await client.createTab(SETTINGS_TAB, SETTINGS_HEADERS);
        tabExists = true;
      }
      const { headers, rows } = await read();
      const row = rows.find((r) => r.key === key);
      if (row) await client.updateCells(SETTINGS_TAB, headers, row.rowNumber, { valor: value, actualizado: at });
      else await client.appendRecord(SETTINGS_TAB, headers, { clave: key, valor: value, actualizado: at });
      cache = null;
    },
  };
}

/** In-memory store for tests. */
export function memorySettings(initial: Record<string, string> = {}): SettingsStore & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    async getAll() {
      return { ...values };
    },
    async set(key, value) {
      values[key] = value;
    },
  };
}
