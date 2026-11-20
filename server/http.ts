/** Wiring between Vercel web-standard handlers and the testable handlers. */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { AuthDeps, Result } from './auth';
import { normalizePrivateKey, serviceAccountTokenSource, SheetsClient } from './sheets';
import { sheetsUserStore } from './users';

export const SERVER_ERROR = 'Error del servidor. Prueba de nuevo.';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

let sheets: SheetsClient | null = null;
function sheetsClient(): SheetsClient {
  if (!sheets) {
    const getToken = serviceAccountTokenSource(
      env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      normalizePrivateKey(env('GOOGLE_PRIVATE_KEY')),
    );
    sheets = new SheetsClient(env('SHEET_ID'), getToken);
  }
  return sheets;
}

export function authDeps(): AuthDeps {
  return {
    users: sheetsUserStore(sheetsClient()),
    secret: env('SESSION_SECRET'),
    now: Date.now,
    newId: randomUUID,
    hash: (password) => bcrypt.hash(password, 10),
    compare: (password, hash) => bcrypt.compare(password, hash),
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Runs a handler and turns its Result (or a crash) into a JSON Response. Never logs secrets. */
export async function respond(run: () => Promise<Result>): Promise<Response> {
  try {
    const { status, body } = await run();
    return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('api error:', e instanceof Error ? e.message : 'unknown');
    return Response.json({ error: SERVER_ERROR }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
