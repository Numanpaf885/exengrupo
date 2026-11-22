import { describe, expect, it, vi } from 'vitest';
import { sheetsSettings } from './settings';
import type { SheetsClient } from './sheets';

function fakeClient(tabs: string[], rows: string[][] = []) {
  const grid = [['clave', 'valor', 'actualizado'], ...rows];
  const client = {
    listTabs: vi.fn(async () => tabs),
    createTab: vi.fn(async () => {
      tabs.push('ajustes');
    }),
    readTable: vi.fn(async () => ({
      headers: grid[0],
      records: grid.slice(1).map((r, i) => ({ rowNumber: i + 2, values: { clave: r[0], valor: r[1], actualizado: r[2] } })),
    })),
    appendRecord: vi.fn(async (_t: string, _h: string[], v: Record<string, string>) => {
      grid.push([v.clave, v.valor, v.actualizado]);
    }),
    updateCells: vi.fn(async (_t: string, _h: string[], row: number, v: Record<string, string>) => {
      grid[row - 1] = [grid[row - 1][0], v.valor, v.actualizado];
    }),
  };
  return client;
}

describe('sheetsSettings', () => {
  it('reads nothing (and never requests the tab) while "ajustes" does not exist', async () => {
    const c = fakeClient(['users']);
    const store = sheetsSettings(c as unknown as SheetsClient);
    expect(await store.getAll()).toEqual({});
    expect(c.readTable).not.toHaveBeenCalled();
  });

  it('creates the tab on the first save, then updates in place', async () => {
    const c = fakeClient(['users']);
    let t = 0;
    const store = sheetsSettings(c as unknown as SheetsClient, () => (t += 60_000));
    await store.set('gemini_model', 'm1', 'T1');
    expect(c.createTab).toHaveBeenCalledWith('ajustes', ['clave', 'valor', 'actualizado']);
    expect(c.appendRecord).toHaveBeenCalledTimes(1);
    await store.set('gemini_model', 'm2', 'T2');
    expect(c.appendRecord).toHaveBeenCalledTimes(1);
    expect(c.updateCells).toHaveBeenCalledWith('ajustes', ['clave', 'valor', 'actualizado'], 2, { valor: 'm2', actualizado: 'T2' });
    expect(await store.getAll()).toEqual({ gemini_model: 'm2' });
  });
});
