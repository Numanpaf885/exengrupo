/**
 * Which key and model each provider uses. Preference order is fixed:
 * Claude, Gemini, Groq, OpenRouter. A key or model saved in the admin panel
 * (Sheet tab "ajustes") wins over the Vercel env var; models fall back to
 * DEFAULT_MODELS.
 */
import { decryptSecret, keyHint } from '../secretbox';
import { claudeClient, testClaudeKey } from './claude';
import {
  answerProvider,
  DEFAULT_MODELS,
  type FetchLike,
  geminiClient,
  groqClient,
  openRouterClient,
  type Provider,
  TIMEOUT_MS,
  type VisionClient,
} from './providers';

export const PROVIDER_IDS = ['claude', 'gemini', 'groq', 'openrouter'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: 'Claude (Anthropic)',
  gemini: 'Gemini (Google)',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

export const PROVIDER_ENV: Record<ProviderId, { key: string; model: string }> = {
  claude: { key: 'ANTHROPIC_API_KEY', model: 'CLAUDE_MODEL' },
  gemini: { key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL' },
  groq: { key: 'GROQ_API_KEY', model: 'GROQ_MODEL' },
  openrouter: { key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL' },
};

export const settingKey = (id: ProviderId) => `${id}_api_key`;
export const settingModel = (id: ProviderId) => `${id}_model`;

export const isProviderId = (x: string): x is ProviderId => (PROVIDER_IDS as readonly string[]).includes(x);

export interface ResolvedProvider {
  id: ProviderId;
  key: string | null;
  keySource: 'admin' | 'vercel' | 'none';
  model: string;
  modelSource: 'admin' | 'vercel' | 'default';
}

export function resolveProviders(
  settings: Record<string, string>,
  env: Record<string, string | undefined>,
  secret: string,
): ResolvedProvider[] {
  return PROVIDER_IDS.map((id) => {
    const stored = settings[settingKey(id)] ? decryptSecret(settings[settingKey(id)], secret) : null;
    const envKey = env[PROVIDER_ENV[id].key]?.trim() || null;
    const storedModel = settings[settingModel(id)]?.trim() || null;
    const envModel = env[PROVIDER_ENV[id].model]?.trim() || null;
    return {
      id,
      key: stored || envKey,
      keySource: stored ? 'admin' : envKey ? 'vercel' : 'none',
      model: storedModel || envModel || DEFAULT_MODELS[id],
      modelSource: storedModel ? 'admin' : envModel ? 'vercel' : 'default',
    };
  });
}

/** What the admin panel shows: never the key itself, only its last 4 characters. */
export function providerViews(resolved: ResolvedProvider[]) {
  return resolved.map((r) => ({
    id: r.id,
    label: PROVIDER_LABELS[r.id],
    key_set: !!r.key,
    key_hint: r.key ? keyHint(r.key) : '',
    key_source: r.keySource,
    model: r.model,
    model_source: r.modelSource,
    model_default: DEFAULT_MODELS[r.id],
  }));
}

/** Configured providers in preference order, able to run any vision prompt. */
export function buildClients(resolved: ResolvedProvider[], fetchImpl?: FetchLike): VisionClient[] {
  const out: VisionClient[] = [];
  for (const r of resolved) {
    if (!r.key) continue;
    if (r.id === 'claude') out.push(claudeClient(r.key, r.model, TIMEOUT_MS, fetchImpl));
    if (r.id === 'gemini') out.push(geminiClient(r.key, r.model, fetchImpl));
    if (r.id === 'groq') out.push(groqClient(r.key, r.model, fetchImpl));
    if (r.id === 'openrouter') out.push(openRouterClient(r.key, r.model, fetchImpl));
  }
  return out;
}

/** Configured answering providers in preference order, ready for analyzePhoto. */
export function buildProviders(resolved: ResolvedProvider[], fetchImpl?: FetchLike): Provider[] {
  return buildClients(resolved, fetchImpl).map((c) => answerProvider(c));
}

export interface KeyTest {
  ok: boolean;
  message: string;
}

const TEST_TIMEOUT_MS = 10_000;

async function get(fetchImpl: FetchLike, url: string, headers: Record<string, string>) {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

/** Checks a key (and model) with free endpoints only: no tokens are used. */
export async function testProviderKey(id: ProviderId, key: string, model: string, fetchImpl: FetchLike = fetch): Promise<KeyTest> {
  try {
    if (id === 'claude') return await testClaudeKey(key, model, fetchImpl);
    if (id === 'gemini') {
      const r = await get(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
        'x-goog-api-key': key,
      });
      if (r.status === 200) return { ok: true, message: `Clave válida. Modelo ${model} disponible.` };
      if (r.status === 404) return { ok: false, message: `La clave funciona, pero el modelo ${model} no existe.` };
      if (r.status === 429) return { ok: true, message: 'Clave válida (límite de uso alcanzado ahora mismo).' };
      return { ok: false, message: 'Clave no válida.' };
    }
    if (id === 'groq') {
      const r = await get(fetchImpl, 'https://api.groq.com/openai/v1/models', { authorization: `Bearer ${key}` });
      if (r.status === 401 || r.status === 403) return { ok: false, message: 'Clave no válida.' };
      if (r.status !== 200) return { ok: false, message: 'No se pudo comprobar. Prueba de nuevo.' };
      const ids = ((r.body?.data as Array<{ id?: string }>) ?? []).map((m) => m.id);
      return ids.includes(model)
        ? { ok: true, message: `Clave válida. Modelo ${model} disponible.` }
        : { ok: false, message: `La clave funciona, pero el modelo ${model} no está en tu cuenta de Groq.` };
    }
    const r = await get(fetchImpl, 'https://openrouter.ai/api/v1/key', { authorization: `Bearer ${key}` });
    if (r.status === 401 || r.status === 403) return { ok: false, message: 'Clave no válida.' };
    if (r.status !== 200) return { ok: false, message: 'No se pudo comprobar. Prueba de nuevo.' };
    const models = await get(fetchImpl, 'https://openrouter.ai/api/v1/models', {});
    const ids = ((models.body?.data as Array<{ id?: string }>) ?? []).map((m) => m.id);
    return ids.includes(model)
      ? { ok: true, message: `Clave válida. Modelo ${model} disponible.` }
      : { ok: false, message: `La clave funciona, pero el modelo ${model} no existe en OpenRouter.` };
  } catch {
    return { ok: false, message: 'No se pudo comprobar. Prueba de nuevo.' };
  }
}
