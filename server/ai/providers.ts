/**
 * Vision providers. Every model ID comes from an env var with a documented default
 * (see .env.example / CLAUDE.md). Keys never leave the server and are never logged.
 */
import { PROMPT } from './answers';
import { geminiRetrySeconds, resetHeaderSeconds, retryAfterHeaderSeconds } from './retry';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type ProviderResult =
  | { ok: true; provider: string; model: string; text: string }
  | { ok: false; provider: string; model: string; rateLimited: boolean; retryAfterSec?: number; error: string };

export type Provider = (jpegBase64: string) => Promise<ProviderResult>;

/** Defaults, checked against each provider's official SDK / docs repo (Nov 2026). */
export const DEFAULT_MODELS = {
  gemini: 'gemini-3.8-flash',
  groq: 'meta-llama/llama-4-scout-17b-16e-instruct',
  openrouter: 'google/gemma-3-27b-it:free',
} as const;

const TIMEOUT_MS = 40_000;

async function send(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

const failure = (provider: string, model: string, error: string, rateLimited = false, retryAfterSec?: number) =>
  ({ ok: false, provider, model, rateLimited, retryAfterSec, error }) as const;

/** Google Gemini generateContent (REST v1beta) with the image inline and JSON output. */
export function geminiProvider(key: string, model: string, fetchImpl: FetchLike = fetch): Provider {
  return async (jpegBase64) => {
    try {
      const res = await send(
        fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } }] },
            ],
            generationConfig: { response_mime_type: 'application/json', temperature: 0 },
          }),
        },
      );
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.status === 429) return failure('gemini', model, 'rate limited', true, geminiRetrySeconds(body));
      if (!res.ok) return failure('gemini', model, `HTTP ${res.status}`);
      const parts =
        (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> })
          ?.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      return text ? { ok: true, provider: 'gemini', model, text } : failure('gemini', model, 'empty reply');
    } catch (e) {
      return failure('gemini', model, e instanceof Error ? e.name : 'error');
    }
  };
}

/** OpenAI-compatible chat completions with an image data URL (Groq, OpenRouter). */
function openAiCompatible(
  provider: string,
  url: string,
  key: string,
  model: string,
  fetchImpl: FetchLike,
  extraHeaders: Record<string, string> = {},
): Provider {
  return async (jpegBase64) => {
    try {
      const res = await send(fetchImpl, url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...extraHeaders },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
              ],
            },
          ],
        }),
      });
      if (res.status === 429) {
        const now = Date.now();
        const retry =
          retryAfterHeaderSeconds(res.headers.get('retry-after'), now) ??
          resetHeaderSeconds(res.headers.get('x-ratelimit-reset'), now);
        return failure(provider, model, 'rate limited', true, retry);
      }
      const body = (await res.json().catch(() => null)) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      } | null;
      if (!res.ok) return failure(provider, model, `HTTP ${res.status}`);
      const content = body?.choices?.[0]?.message?.content;
      const text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map((c) => (c as { text?: string }).text ?? '').join('')
            : '';
      return text ? { ok: true, provider, model, text } : failure(provider, model, 'empty reply');
    } catch (e) {
      return failure(provider, model, e instanceof Error ? e.name : 'error');
    }
  };
}

export const groqProvider = (key: string, model: string, fetchImpl: FetchLike = fetch): Provider =>
  openAiCompatible('groq', 'https://api.groq.com/openai/v1/chat/completions', key, model, fetchImpl);

export const openRouterProvider = (key: string, model: string, fetchImpl: FetchLike = fetch): Provider =>
  openAiCompatible('openrouter', 'https://openrouter.ai/api/v1/chat/completions', key, model, fetchImpl, {
    'x-title': 'exengrupo',
  });
