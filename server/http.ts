/** Wiring between Vercel web-standard handlers and the testable handlers. */
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { AdminDeps } from './admin';
import { buildClients, resolveProviders, testProviderKey } from './ai/config';
import { TIMEOUT_MS } from './ai/providers';
import type { AuthDeps, Result } from './auth';
import type { DataDeps } from './context';
import type { FileDeps } from './files/handlers';
import { analyzeWithReferences, loadSpaceChunks } from './files/refs';
import type { PostDeps } from './posts';
import { supabaseBroadcaster } from './realtime';
import type { FileRecord, MemberRecord, PostRecord, SpaceRecord, UserRecord } from './schema';
import { type SettingsStore, sheetsSettings } from './settings';
import { normalizePrivateKey, serviceAccountTokenSource, SheetsClient } from './sheets';
import { r2Storage } from './storage';
import { sheetsTable } from './table';
import { sheetsUserStore } from './users';

export const SERVER_ERROR = 'Error del servidor. Prueba de nuevo.';

/**
 * Env var values with surrounding spaces and line breaks removed. Values pasted
 * into Vercel with a trailing Enter otherwise break HTTP headers (R2 signing).
 */
export function cleanEnv(source: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) out[k] = typeof v === 'string' ? v.trim() : v;
  return out;
}

export function env(name: string): string {
  const value = process.env[name]?.trim();
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

let settingsStore: SettingsStore | null = null;
function settings(): SettingsStore {
  settingsStore ??= sheetsSettings(sheetsClient());
  return settingsStore;
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

export function dataDeps(): DataDeps {
  const client = sheetsClient();
  return {
    users: sheetsTable<UserRecord>(client, 'users'),
    spaces: sheetsTable<SpaceRecord>(client, 'spaces'),
    members: sheetsTable<MemberRecord>(client, 'members'),
    posts: sheetsTable<PostRecord>(client, 'posts'),
    secret: env('SESSION_SECRET'),
    now: Date.now,
    newId: randomUUID,
    randomIndex: (n) => randomInt(n),
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
  };
}

function storage() {
  return r2Storage({
    accountId: env('R2_ACCOUNT_ID'),
    bucket: env('R2_BUCKET'),
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
  });
}

/** Keys/models from the admin panel win over Vercel's; order Claude, Gemini, Groq, OpenRouter. */
async function visionClients(secret: string) {
  return buildClients(resolveProviders(await settings().getAll(), cleanEnv(), secret));
}

export function fileDeps(): FileDeps {
  const data = dataDeps();
  return {
    ...data,
    files: sheetsTable<FileRecord>(sheetsClient(), 'files'),
    storage: storage(),
    clients: () => visionClients(data.secret),
    log: (message) => console.error(message),
  };
}

export function postDeps(): PostDeps {
  const data = dataDeps();
  const r2 = storage();
  const files = sheetsTable<FileRecord>(sheetsClient(), 'files');
  return {
    ...data,
    storage: r2,
    analyze: async (jpegBase64, spaceId) => {
      // Keep the whole run inside Vercel's 60 s: no new fallback after this point.
      const fallbackDeadline = Date.now() + 60_000 - TIMEOUT_MS - 6_000;
      return analyzeWithReferences(jpegBase64, {
        clients: await visionClients(data.secret),
        chunks: () => loadSpaceChunks(files, r2, spaceId),
        fallbackDeadline,
        log: (message) => console.error(message),
      });
    },
    broadcast: supabaseBroadcaster(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY')),
    log: (message) => console.error(message),
  };
}

export function adminDeps(): AdminDeps {
  return {
    ...dataDeps(),
    adminPassword: process.env.ADMIN_PASSWORD?.trim() || undefined,
    settings: settings(),
    env: cleanEnv(),
    testKey: (id, key, model) => testProviderKey(id, key, model),
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
