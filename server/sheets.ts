/**
 * Tiny Google Sheets v4 client for the "exengrupo DB" sheet.
 * Auth: service-account JWT (RS256 via node:crypto) exchanged for an access
 * token — no Google SDK needed. Tabs and row-1 headers are fixed; this client
 * maps columns BY HEADER NAME and never writes row 1.
 */
import { createSign } from 'node:crypto';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** GOOGLE_PRIVATE_KEY is pasted with literal "\n"; turn them into newlines. */
export function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n');
}

export function makeServiceAccountJwt(email: string, privateKey: string, nowSec: number): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

/** Returns a function that yields a cached access token, refreshing 5 min before expiry. */
export function serviceAccountTokenSource(
  email: string,
  privateKey: string,
  fetchImpl: FetchLike = fetch,
  now: () => number = Date.now,
): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (cached && cached.expiresAt - 5 * 60_000 > now()) return cached.token;
    const assertion = makeServiceAccountJwt(email, privateKey, Math.floor(now() / 1000));
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    });
    if (!res.ok) throw new SheetsError(`Google token request failed (${res.status})`, res.status);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: data.access_token, expiresAt: now() + data.expires_in * 1000 };
    return cached.token;
  };
}

/** 1 → A, 26 → Z, 27 → AA */
export function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export interface SheetRecord {
  /** 1-based sheet row number (row 1 is the header). */
  rowNumber: number;
  values: Record<string, string>;
}

export interface SheetTable {
  headers: string[];
  records: SheetRecord[];
}

/** Turn the raw values grid (row 1 = headers) into records keyed by header. */
export function gridToTable(grid: unknown[][] | undefined): SheetTable {
  const rows = grid ?? [];
  const headers = (rows[0] ?? []).map((h) => String(h).trim());
  const records: SheetRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (row.every((c) => c === '' || c == null)) continue;
    const values: Record<string, string> = {};
    headers.forEach((h, j) => {
      values[h] = row[j] == null ? '' : String(row[j]);
    });
    records.push({ rowNumber: i + 1, values });
  }
  return { headers, records };
}

/** Order a record's values by the sheet's headers. Unknown keys are an error (schema is fixed). */
export function recordToRow(headers: string[], values: Record<string, string>): string[] {
  for (const key of Object.keys(values)) {
    if (!headers.includes(key)) throw new Error(`Column "${key}" is not in the sheet headers`);
  }
  return headers.map((h) => values[h] ?? '');
}

export class SheetsClient {
  constructor(
    private readonly sheetId: string,
    private readonly getToken: () => Promise<string>,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.getToken();
    const res = await this.fetchImpl(`${SHEETS_URL}/${encodeURIComponent(this.sheetId)}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
    });
    if (!res.ok) throw new SheetsError(`Sheets request failed (${res.status})`, res.status);
    return res.json();
  }

  async readTable(tab: string): Promise<SheetTable> {
    const data = (await this.call(`/values/${encodeURIComponent(tab)}`)) as { values?: unknown[][] };
    return gridToTable(data.values);
  }

  async appendRecord(tab: string, headers: string[], values: Record<string, string>): Promise<void> {
    await this.call(
      `/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [recordToRow(headers, values)] }) },
    );
  }

  /** Update some cells of one data row (never row 1). */
  async updateCells(tab: string, headers: string[], rowNumber: number, values: Record<string, string>) {
    if (rowNumber < 2) throw new Error('Refusing to write the header row');
    for (const [key, value] of Object.entries(values)) {
      const col = headers.indexOf(key);
      if (col === -1) throw new Error(`Column "${key}" is not in the sheet headers`);
      const range = `${tab}!${columnLetter(col + 1)}${rowNumber}`;
      await this.call(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [[value]] }),
      });
    }
  }
}
