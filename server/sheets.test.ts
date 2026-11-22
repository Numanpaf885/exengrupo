import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  columnLetter,
  gridToTable,
  makeServiceAccountJwt,
  normalizePrivateKey,
  recordToRow,
  serviceAccountTokenSource,
  SheetsClient,
} from './sheets';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('helpers', () => {
  it('converts literal \\n in the private key', () => {
    expect(normalizePrivateKey('-----BEGIN-----\\nabc\\n-----END-----')).toBe('-----BEGIN-----\nabc\n-----END-----');
  });

  it('computes column letters', () => {
    expect([1, 5, 26, 27, 52, 53].map(columnLetter)).toEqual(['A', 'E', 'Z', 'AA', 'AZ', 'BA']);
  });

  it('maps a grid to records by header, skipping blank rows', () => {
    const t = gridToTable([
      ['user_id', 'username', 'password_hash'],
      ['u1', 'ana', 'h1'],
      [],
      ['u2', 'luis'],
    ]);
    expect(t.headers).toEqual(['user_id', 'username', 'password_hash']);
    expect(t.records).toEqual([
      { rowNumber: 2, values: { user_id: 'u1', username: 'ana', password_hash: 'h1' } },
      { rowNumber: 4, values: { user_id: 'u2', username: 'luis', password_hash: '' } },
    ]);
  });

  it('orders values by headers and refuses unknown columns', () => {
    expect(recordToRow(['a', 'b', 'c'], { c: '3', a: '1' })).toEqual(['1', '', '3']);
    expect(() => recordToRow(['a'], { z: '1' })).toThrow(/not in the sheet headers/);
  });
});

describe('service account auth', () => {
  it('builds an RS256 JWT for the Sheets scope', () => {
    const jwt = makeServiceAccountJwt('bot@example.iam.gserviceaccount.com', PEM, 1000);
    const [h, p, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toMatchObject({
      iss: 'bot@example.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1000,
      exp: 4600,
    });
    expect(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('caches the access token until near expiry', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: 'tok', expires_in: 3600 }));
    let now = 0;
    const getToken = serviceAccountTokenSource('bot@x', PEM, fetchMock, () => now);
    expect(await getToken()).toBe('tok');
    now = 50 * 60_000;
    await getToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now = 56 * 60_000;
    await getToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('SheetsClient (mocked fetch)', () => {
  const setup = (body: unknown = {}) => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(body));
    return { fetchMock, client: new SheetsClient('sheet-1', async () => 'tok', fetchMock) };
  };

  it('reads a tab', async () => {
    const { fetchMock, client } = setup({ values: [['user_id', 'username'], ['u1', 'ana']] });
    const t = await client.readTable('users');
    expect(t.records[0].values.username).toBe('ana');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sheets.googleapis.com/v4/spreadsheets/sheet-1/values/users');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('appends a row as RAW values in header order', async () => {
    const { fetchMock, client } = setup();
    await client.appendRecord('users', ['user_id', 'username'], { username: 'ana', user_id: 'u1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/values/users!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ values: [['u1', 'ana']] });
  });

  it('updates single cells and never row 1', async () => {
    const { fetchMock, client } = setup();
    await client.updateCells('users', ['user_id', 'username', 'last_login'], 5, { last_login: 'now', username: 'x' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sheets.googleapis.com/v4/spreadsheets/sheet-1/values:batchUpdate');
    expect(JSON.parse(String(init?.body))).toEqual({
      valueInputOption: 'RAW',
      data: [
        { range: 'users!C5', values: [['now']] },
        { range: 'users!B5', values: [['x']] },
      ],
    });
    await expect(client.updateCells('users', ['a'], 1, { a: 'x' })).rejects.toThrow(/header row/);
  });

  it('throws SheetsError with the status on failure', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'nope' }, 403));
    const client = new SheetsClient('s', async () => 't', fetchMock);
    await expect(client.readTable('users')).rejects.toMatchObject({ status: 403 });
  });
});

describe('SheetsClient tabs', () => {
  it('lists tab titles and creates a new tab with headers', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes('fields=sheets.properties.title')
        ? jsonResponse({ sheets: [{ properties: { title: 'users' } }, { properties: { title: 'posts' } }] })
        : jsonResponse({}),
    );
    const client = new SheetsClient('s1', async () => 't', fetchMock);
    expect(await client.listTabs()).toEqual(['users', 'posts']);
    await client.createTab('ajustes', ['clave', 'valor', 'actualizado']);
    const [addUrl, addInit] = fetchMock.mock.calls[1];
    expect(addUrl).toBe('https://sheets.googleapis.com/v4/spreadsheets/s1:batchUpdate');
    expect(JSON.parse(String(addInit?.body))).toEqual({ requests: [{ addSheet: { properties: { title: 'ajustes' } } }] });
    const [hdrUrl, hdrInit] = fetchMock.mock.calls[2];
    expect(hdrUrl).toContain(`/values/${encodeURIComponent('ajustes!A1')}?valueInputOption=RAW`);
    expect(JSON.parse(String(hdrInit?.body))).toEqual({ values: [['clave', 'valor', 'actualizado']] });
  });
});

describe('SheetsClient quota protection', () => {
  const table = { values: [['user_id'], ['u1']] };
  const status = (code: number) => new Response(JSON.stringify({ error: {} }), { status: code });

  it('shares reads of the same tab for a few seconds and re-reads after a write', async () => {
    let now = 0;
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(table));
    const client = new SheetsClient('s', async () => 't', fetchMock, { now: () => now, cacheMs: 4000 });
    await Promise.all([client.readTable('users'), client.readTable('users'), client.readTable('spaces')]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now = 3000;
    await client.readTable('users');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await client.appendRecord('users', ['user_id'], { user_id: 'u2' });
    await client.readTable('users');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    now = 9000;
    await client.readTable('spaces');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('retries a 429 (Google per-minute quota) and then succeeds', async () => {
    const replies = [status(429), status(429), jsonResponse(table)];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => replies.shift()!);
    const sleeps: number[] = [];
    const client = new SheetsClient('s', async () => 't', fetchMock, { sleep: async (ms) => void sleeps.push(ms) });
    expect((await client.readTable('users')).records).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
  });

  it('gives up after the last retry and never retries a 4xx other than 429', async () => {
    const always429 = vi.fn(async (_url: string, _init?: RequestInit) => status(429));
    const a = new SheetsClient('s', async () => 't', always429, { sleep: async () => undefined, retryDelaysMs: [1, 1] });
    await expect(a.readTable('users')).rejects.toThrow('Sheets request failed (429)');
    expect(always429).toHaveBeenCalledTimes(3);
    const forbidden = vi.fn(async (_url: string, _init?: RequestInit) => status(403));
    const b = new SheetsClient('s', async () => 't', forbidden, { sleep: async () => undefined });
    await expect(b.readTable('users')).rejects.toThrow('(403)');
    expect(forbidden).toHaveBeenCalledTimes(1);
    // A failed read is not cached.
    await expect(b.readTable('users')).rejects.toThrow('(403)');
    expect(forbidden).toHaveBeenCalledTimes(2);
  });
});
