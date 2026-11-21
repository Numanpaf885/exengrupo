/**
 * Runs two vision models in parallel (Gemini + Groq). If either fails or hits a
 * rate limit, the OpenRouter model takes its place. Then parses, merges and formats.
 */
import { AI_FAILED, formatAnswers, mergeAnswers, parseAnswers, quotaMessage, UNREADABLE } from './answers';
import type { Provider, ProviderResult } from './providers';
import { retryMinutes } from './retry';

export interface AiOutcome {
  status: 'done' | 'error';
  /** The display line, or a Spanish error message. */
  answer: string;
  /** Which models produced the answer, e.g. "gemini:gemini-3.8-flash, groq:…". */
  models: string;
}

export interface AiProviders {
  first: Provider;
  second: Provider;
  fallback: Provider | null;
}

export async function analyzePhoto(providers: AiProviders, jpegBase64: string): Promise<AiOutcome> {
  const [a, b] = await Promise.all([providers.first(jpegBase64), providers.second(jpegBase64)]);

  // One shared fallback call: it fills the first failed slot (or both, as a single answer).
  let fallbackCall: Promise<ProviderResult> | null = null;
  const fallback = () => (fallbackCall ??= providers.fallback ? providers.fallback(jpegBase64) : Promise.resolve(a));
  const r1 = a.ok ? a : await fallback();
  const r2 = b.ok ? b : a.ok ? await fallback() : null;

  const results = [a, b, ...(fallbackCall ? [await fallbackCall] : [])];
  const used = [r1, r2].filter((r, i, arr): r is ProviderResult & { ok: true } => !!r?.ok && arr.indexOf(r) === i);
  const parsed = used.map((r) => ({ r, answers: parseAnswers(r.text) })).filter((x) => x.answers !== null);

  if (parsed.length === 0) {
    const failed = results.filter((r): r is ProviderResult & { ok: false } => !r.ok);
    const allRateLimited = failed.length === results.length && failed.every((r) => r.rateLimited);
    if (allRateLimited) {
      return { status: 'error', answer: quotaMessage(retryMinutes(failed.map((r) => r.retryAfterSec))), models: '' };
    }
    return { status: 'error', answer: AI_FAILED, models: '' };
  }

  const merged = mergeAnswers(parsed[0].answers, parsed[1]?.answers ?? null);
  const models = parsed.map((p) => `${p.r.provider}:${p.r.model}`).join(', ');
  if (merged.length === 0) return { status: 'error', answer: UNREADABLE, models };
  return { status: 'done', answer: formatAnswers(merged), models };
}
