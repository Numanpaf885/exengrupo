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

/** One vision request: a prompt plus one image or PDF (base64). */
export interface VisionInput {
  prompt: string;
  mime: 'image/jpeg' | 'image/png' | 'application/pdf';
  data: string;
  /** Ask for JSON output where the API supports it (Gemini). */
  json?: boolean;
  timeoutMs?: number;
}

/** A configured provider that can run any vision prompt. */
export interface VisionClient {
  id: 'claude' | 'gemini' | 'groq' | 'openrouter';
  model: string;
  /** Can read PDFs directly (Claude, Gemini). */
  pdf: boolean;
  call: (input: VisionInput) => Promise<ProviderResult>;
}

/** The answering provider: the answer prompt (JSON) + the photo. */
export const answerProvider =
  (client: VisionClient, prompt: string = PROMPT): Provider =>
  (jpegBase64) =>
    client.call({ prompt, mime: 'image/jpeg', data: jpegBase64, json: true });

/** Defaults, checked against each provider's official SDK / docs repo (Nov 2026). */
export const DEFAULT_MODELS = {
  claude: 'claude-opus-5-5',
  gemini: 'gemini-3.8-flash',
  groq: 'meta-llama/llama-4-scout-17b-16e-instruct',
  openrouter: 'google/gemma-3-27b-it:free',
} as const;

/** Per call; analyzePhoto keeps the whole run inside the 60 s Vercel limit. */
export const TIMEOUT_MS = 26_000;

async function send(fetchImpl: FetchLike, url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

const failure = (provider: string, model: string, error: string, rateLimited = false, retryAfterSec?: number) =>
  ({ ok: false, provider, model, rateLimited, retryAfterSec, error }) as const;

/** Google Gemini generateContent (REST v1beta) with the image or PDF inline. */
export function geminiClient(key: string, model: string, fetchImpl: FetchLike = fetch): VisionClient {
  const call = async ({ prompt, mime, data, json, timeoutMs }: VisionInput): Promise<ProviderResult> => {
    try {
      const res = await send(
        fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data } }] }],
            generationConfig: json ? { response_mime_type: 'application/json', temperature: 0 } : { temperature: 0 },
          }),
        },
        timeoutMs,
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
  return { id: 'gemini', model, pdf: true, call };
}

export const geminiProvider = (key: string, model: string, fetchImpl: FetchLike = fetch): Provider =>
  answerProvider(geminiClient(key, model, fetchImpl));

/** OpenAI-compatible chat completions with an image data URL (Groq, OpenRouter). */
function openAiCompatible(
  provider: 'groq' | 'openrouter',
  url: string,
  key: string,
  model: string,
  fetchImpl: FetchLike,
  extraHeaders: Record<string, string> = {},
): VisionClient {
  const call = async ({ prompt, mime, data, timeoutMs }: VisionInput): Promise<ProviderResult> => {
    if (mime === 'application/pdf') return failure(provider, model, 'pdf not supported');
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
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mime};base64,${data}` } },
              ],
            },
          ],
        }),
      }, timeoutMs);
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
  return { id: provider, model, pdf: false, call };
}

export const groqClient = (key: string, model: string, fetchImpl: FetchLike = fetch): VisionClient =>
  openAiCompatible('groq', 'https://api.groq.com/openai/v1/chat/completions', key, model, fetchImpl);

export const openRouterClient = (key: string, model: string, fetchImpl: FetchLike = fetch): VisionClient =>
  openAiCompatible('openrouter', 'https://openrouter.ai/api/v1/chat/completions', key, model, fetchImpl, {
    'x-title': 'exengrupo',
  });

export const groqProvider = (key: string, model: string, fetchImpl: FetchLike = fetch): Provider =>
  answerProvider(groqClient(key, model, fetchImpl));

export const openRouterProvider = (key: string, model: string, fetchImpl: FetchLike = fetch): Provider =>
  answerProvider(openRouterClient(key, model, fetchImpl));
