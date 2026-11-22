/**
 * Runs the two most preferred configured providers in parallel (order:
 * Claude, Gemini, Groq, OpenRouter): with a Claude key, Claude always answers
 * plus the next best AI. Each slot works on its own: as soon as its AI fails,
 * hits a rate limit or replies with something that isn't the JSON we asked for,
 * the next provider in the order takes that slot at once (it no longer waits for
 * the other slot to finish). Then parses, merges and formats. Every failure is
 * recorded ("fail …" segment in posts.models) so the admin can see why.
 */
import {
  AI_FAILED,
  type Answer,
  formatAnswers,
  mergeAnswers,
  parseAnswers,
  quotaMessage,
  UNREADABLE,
} from './answers';
import type { Provider, ProviderResult } from './providers';
import { retryMinutes } from './retry';
import { encodeSources, mergeSources } from './sources';

export interface AiOutcome {
  status: 'done' | 'error';
  /** The display line, or a Spanish error message. */
  answer: string;
  /** Which models produced the answer, e.g. "claude:claude-opus-5-5, gemini:gemini-3.8-flash". */
  models: string;
}

export interface AnalyzeOptions {
  /** No new fallback call starts after this moment (ms epoch). */
  fallbackDeadline?: number;
  now?: () => number;
}

type Attempt = { result: ProviderResult; answers: Answer[] | null };

async function attempt(provider: Provider, b64: string): Promise<Attempt> {
  const result = await provider(b64);
  return { result, answers: result.ok ? parseAnswers(result.text) : null };
}

/** Why an attempt didn't give usable answers, e.g. "gemini=HTTP 404". */
function failure(a: Attempt): string {
  const reason = a.result.ok ? 'respuesta no válida' : a.result.error;
  return `${a.result.provider}=${reason.replace(/[|;=]/g, ' ').slice(0, 60)}`;
}

/** "fail gemini=HTTP 404; openrouter=rate limited" ("" when nothing failed). */
export function encodeFailures(attempts: Attempt[]): string {
  const failed = attempts.filter((a) => a.answers === null).map(failure);
  return failed.length ? `fail ${failed.join('; ')}` : '';
}

const join = (...segments: string[]) => segments.filter(Boolean).join(' | ');

/** `providers` is the configured list, most preferred first. */
export async function analyzePhoto(providers: Provider[], jpegBase64: string, opts: AnalyzeOptions = {}): Promise<AiOutcome> {
  const now = opts.now ?? Date.now;
  if (providers.length === 0) return { status: 'error', answer: AI_FAILED, models: '' };

  const queue = providers.slice(2);
  const attempts: Attempt[] = [];
  const canFallBack = () => queue.length > 0 && (opts.fallbackDeadline === undefined || now() < opts.fallbackDeadline);

  // Each slot keeps trying the next provider as soon as its own one fails.
  const runSlot = async (first: Provider): Promise<Attempt> => {
    let current = await attempt(first, jpegBase64);
    attempts.push(current);
    while (current.answers === null && canFallBack()) {
      current = await attempt(queue.shift() as Provider, jpegBase64);
      attempts.push(current);
    }
    return current;
  };
  const slots = await Promise.all(providers.slice(0, 2).map(runSlot));
  const fails = encodeFailures(attempts);

  const good = slots.filter((s): s is Attempt & { result: ProviderResult & { ok: true }; answers: Answer[] } => s.answers !== null);
  if (good.length === 0) {
    const failed = attempts.map((a) => a.result).filter((r): r is ProviderResult & { ok: false } => !r.ok);
    const allRateLimited = failed.length === attempts.length && failed.every((r) => r.rateLimited);
    if (allRateLimited) {
      return { status: 'error', answer: quotaMessage(retryMinutes(failed.map((r) => r.retryAfterSec))), models: fails };
    }
    return { status: 'error', answer: AI_FAILED, models: fails };
  }

  const merged = mergeAnswers(good[0].answers, good[1]?.answers ?? null);
  const models = good.map((g) => `${g.result.provider}:${g.result.model}`).join(', ');
  if (merged.length === 0) return { status: 'error', answer: UNREADABLE, models: join(models, fails) };
  // Which AI gave each answer, shown next to it in the app.
  const by = encodeSources(mergeSources(good[0].answers, good[1]?.answers ?? null, good[0].result.provider, good[1]?.result.provider));
  return { status: 'done', answer: formatAnswers(merged), models: join(models, by, fails) };
}
