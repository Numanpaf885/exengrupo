/** Wiring between Vercel web-standard handlers and the testable handlers. */
import bcrypt from 'bcryptjs';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { analyzePhoto } from './ai/analyze';
import {
  DEFAULT_MODELS,
  geminiProvider,
  groqProvider,
  openRouterProvider,
  type Provider,
} from './ai/providers';
import type { AuthDeps, Result } from './auth';
import type { DataDeps } from './context';
import type { PostDeps } from './posts';
import { supabaseBroadcaster } from './realtime';
import type { MemberRecord, PostRecord, SpaceRecord, UserRecord } from './schema';
import { normalizePrivateKey, serviceAccountTokenSource, SheetsClient } from './sheets';
import { r2Storage } from './storage';
import { sheetsTable } from './table';
import { sheetsUserStore } from './users';

export const SERVER_ERROR = 'Error del servidor. Prueba de nuevo.';

export function env(name: string): string {
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

const optional = (name: string): string | undefined => process.env[name] || undefined;

/** A provider whose key isn't configured simply fails, so the fallback takes over. */
const notConfigured =
  (provider: string, model: string): Provider =>
  async () => ({ ok: false, provider, model, rateLimited: false, error: 'not configured' });

export function postDeps(): PostDeps {
  const geminiModel = optional('GEMINI_MODEL') ?? DEFAULT_MODELS.gemini;
  const groqModel = optional('GROQ_MODEL') ?? DEFAULT_MODELS.groq;
  const openRouterModel = optional('OPENROUTER_MODEL') ?? DEFAULT_MODELS.openrouter;
  const geminiKey = optional('GEMINI_API_KEY');
  const groqKey = optional('GROQ_API_KEY');
  const openRouterKey = optional('OPENROUTER_API_KEY');
  const providers = {
    first: geminiKey ? geminiProvider(geminiKey, geminiModel) : notConfigured('gemini', geminiModel),
    second: groqKey ? groqProvider(groqKey, groqModel) : notConfigured('groq', groqModel),
    fallback: openRouterKey ? openRouterProvider(openRouterKey, openRouterModel) : null,
  };
  return {
    ...dataDeps(),
    storage: r2Storage({
      accountId: env('R2_ACCOUNT_ID'),
      bucket: env('R2_BUCKET'),
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    }),
    analyze: (jpegBase64) => analyzePhoto(providers, jpegBase64),
    broadcast: supabaseBroadcaster(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY')),
    log: (message) => console.error(message),
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
