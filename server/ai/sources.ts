/**
 * Which AI gave each answer. Stored inside the posts.models cell (the Sheet
 * schema is fixed) as one extra " | by …" segment, e.g.
 *   "claude:claude-opus-5-5, gemini:gemini-3.8-flash | by 1:claude+gemini 2:claude 3:claude=b,gemini=c"
 * and turned into short labels for the app ("Claude + Gemini", "Claude: b · Gemini: c").
 * The other segments (models, "ref: …") are never sent to the app.
 */
import type { Answer } from './answers';

export interface Source {
  /** Providers that gave this answer (both when they agree). */
  providers: string[];
  /** When two models disagree: what each one said. */
  split?: Array<{ provider: string; answer: string }>;
}

export const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const name = (id: string) => PROVIDER_NAMES[id] ?? id;

/** Same rules as mergeAnswers: agree → both, disagree → split, one answer or open text → the model whose answer is shown. */
export function mergeSources(
  first: Answer[] | null,
  second: Answer[] | null,
  firstId: string,
  secondId: string | undefined,
): Map<number, Source> {
  const a = new Map((first ?? []).map((x) => [x.n, x]));
  const b = new Map((second ?? []).map((x) => [x.n, x]));
  const out = new Map<number, Source>();
  for (const n of [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y)) {
    const x = a.get(n);
    const y = b.get(n);
    if (x && y && secondId) {
      if (x.type === 'open' || y.type === 'open') out.set(n, { providers: [x.type === 'open' ? firstId : secondId] });
      else if (x.answer === y.answer) out.set(n, { providers: [firstId, secondId] });
      else out.set(n, { providers: [firstId, secondId], split: [{ provider: firstId, answer: x.answer }, { provider: secondId, answer: y.answer }] });
    } else {
      out.set(n, { providers: [x ? firstId : (secondId ?? firstId)] });
    }
  }
  return out;
}

const SAFE = /^[A-Za-z0-9]{1,8}$/;

/** "by 1:claude+gemini 3:claude=b,gemini=c" ("" when empty). */
export function encodeSources(sources: Map<number, Source>): string {
  const parts = [...sources].map(([n, s]) => {
    const split = s.split?.every((p) => SAFE.test(p.answer)) ? s.split : undefined;
    return `${n}:${split ? split.map((p) => `${p.provider}=${p.answer}`).join(',') : s.providers.join('+')}`;
  });
  return parts.length ? `by ${parts.join(' ')}` : '';
}

export function decodeSources(models: string): Map<number, Source> {
  const out = new Map<number, Source>();
  const segment = models.split(' | ').find((s) => s.startsWith('by '));
  if (!segment) return out;
  for (const item of segment.slice(3).trim().split(/\s+/)) {
    const m = /^(\d+):(.+)$/.exec(item);
    if (!m) continue;
    if (m[2].includes('=')) {
      const split = m[2].split(',').map((p) => {
        const [provider, answer] = p.split('=');
        return { provider, answer: answer ?? '' };
      });
      out.set(Number(m[1]), { providers: split.map((p) => p.provider), split });
    } else {
      out.set(Number(m[1]), { providers: m[2].split('+') });
    }
  }
  return out;
}

/** Providers listed in the first segment ("claude:model, gemini:model"). */
export function modelProviders(models: string): string[] {
  const first = models.split(' | ')[0] ?? '';
  return first
    .split(',')
    .map((s) => s.trim().split(':')[0])
    .filter((id) => !!id && id !== 'by' && id !== 'ref');
}

/**
 * Label per question number for the app. Posts saved before this existed have
 * no "by" segment: if only one model answered, every question gets its name.
 */
export function answerLabels(answerLine: string, models: string): Record<string, string> {
  const numbers = [...answerLine.matchAll(/(?:^|\s{2})(\d+)\./g)].map((m) => Number(m[1]));
  const sources = decodeSources(models);
  const fallback = modelProviders(models);
  const labels: Record<string, string> = {};
  for (const n of numbers) {
    const s = sources.get(n) ?? (fallback.length === 1 ? { providers: fallback } : undefined);
    if (!s) continue;
    labels[n] = s.split ? s.split.map((p) => `${name(p.provider)}: ${p.answer}`).join(' · ') : s.providers.map(name).join(' + ');
  }
  return labels;
}
