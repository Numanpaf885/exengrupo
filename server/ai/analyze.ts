/**
 * Runs the two most preferred configured providers in parallel (order:
 * Claude, Gemini, Groq, OpenRouter). When one fails, hits a rate limit or
 * replies with something that isn't the JSON we asked for, the next provider
 * in the order takes its place. Then parses, merges and formats.
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

/** `providers` is the configured list, most preferred first. */
export async function analyzePhoto(providers: Provider[], jpegBase64: string, opts: AnalyzeOptions = {}): Promise<AiOutcome> {
  const now = opts.now ?? Date.now;
  if (providers.length === 0) return { status: 'error', answer: AI_FAILED, models: '' };

  const queue = providers.slice(2);
  const attempts: Attempt[] = [];
  const slots = await Promise.all(providers.slice(0, 2).map((p) => attempt(p, jpegBase64)));
  attempts.push(...slots);

  for (let i = 0; i < slots.length; i++) {
    while (slots[i].answers === null && queue.length > 0 && (opts.fallbackDeadline === undefined || now() < opts.fallbackDeadline)) {
      const next = await attempt(queue.shift() as Provider, jpegBase64);
      attempts.push(next);
      slots[i] = next;
    }
  }

  const good = slots.filter((s): s is Attempt & { result: ProviderResult & { ok: true }; answers: Answer[] } => s.answers !== null);
  if (good.length === 0) {
    const failed = attempts.map((a) => a.result).filter((r): r is ProviderResult & { ok: false } => !r.ok);
    const allRateLimited = failed.length === attempts.length && failed.every((r) => r.rateLimited);
    if (allRateLimited) {
      return { status: 'error', answer: quotaMessage(retryMinutes(failed.map((r) => r.retryAfterSec))), models: '' };
    }
    return { status: 'error', answer: AI_FAILED, models: '' };
  }

  const merged = mergeAnswers(good[0].answers, good[1]?.answers ?? null);
  const models = good.map((g) => `${g.result.provider}:${g.result.model}`).join(', ');
  if (merged.length === 0) return { status: 'error', answer: UNREADABLE, models };
  // Which AI gave each answer, shown next to it in the app.
  const by = encodeSources(mergeSources(good[0].answers, good[1]?.answers ?? null, good[0].result.provider, good[1]?.result.provider));
  return { status: 'done', answer: formatAnswers(merged), models: by ? `${models} | ${by}` : models };
}
