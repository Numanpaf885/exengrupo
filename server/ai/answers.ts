/**
 * Pure answer logic: parse a model's JSON, merge two models per question
 * number, and format the one-line display string.
 *   1.a  2.c  3.b/c ?  4.V  5. El agua hierve a 100 °C.
 */

export type AnswerType = 'mc' | 'tf' | 'open';

export interface Answer {
  n: number;
  type: AnswerType;
  answer: string;
}

/** Display messages (Spanish, shown as-is). */
export const UNREADABLE = 'No se lee bien, repite la foto';
export const quotaMessage = (minutes: number) => `Límite de IA alcanzado, prueba en ${minutes} min`;
export const AI_FAILED = 'No se pudo analizar la foto. Prueba de nuevo.';

function normalizeAnswer(type: AnswerType, raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (type === 'mc') {
    const m = /^\(?([a-zA-Z])\)?[.)]?$/.exec(s) ?? /^([a-zA-Z])\b/.exec(s);
    return m ? m[1].toLowerCase() : null;
  }
  if (type === 'tf') {
    const t = s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[.!]/g, '');
    if (['v', 'verdadero', 'true', 't', 'cierto', 'si'].includes(t)) return 'V';
    if (['f', 'falso', 'false'].includes(t)) return 'F';
    return null;
  }
  return s.replace(/\s+/g, ' ');
}

/**
 * Parses a model reply into answers. Accepts code fences or extra text around
 * the JSON array. Returns null if there is no valid JSON array at all, and []
 * if the model said there were no readable questions.
 */
export function parseAnswers(text: string): Answer[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end < start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const byNumber = new Map<number, Answer>();
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const { n, type, answer } = item as Record<string, unknown>;
    const num = typeof n === 'number' ? n : typeof n === 'string' ? Number.parseInt(n, 10) : NaN;
    if (!Number.isInteger(num) || num < 1 || num > 999) continue;
    if (type !== 'mc' && type !== 'tf' && type !== 'open') continue;
    if (typeof answer !== 'string' && typeof answer !== 'boolean') continue;
    const normalized = normalizeAnswer(type, String(answer));
    if (normalized === null) continue;
    if (!byNumber.has(num)) byNumber.set(num, { n: num, type, answer: normalized });
  }
  return [...byNumber.values()].sort((a, b) => a.n - b.n);
}

export interface MergedAnswer {
  n: number;
  type: AnswerType;
  /** e.g. "a", "V", "b/c" or an open sentence. */
  answer: string;
  /** true when the two models disagree. */
  unsure: boolean;
}

/**
 * Merge per question number. Same answer → that answer. Different → "x/y ?".
 * Only one model answered → its answer. Open answers → first model's text, no flag.
 */
export function mergeAnswers(first: Answer[] | null, second: Answer[] | null): MergedAnswer[] {
  const a = new Map((first ?? []).map((x) => [x.n, x]));
  const b = new Map((second ?? []).map((x) => [x.n, x]));
  const numbers = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y);
  return numbers.map((n) => {
    const x = a.get(n);
    const y = b.get(n);
    if (x && y) {
      if (x.type === 'open' || y.type === 'open') {
        const open = x.type === 'open' ? x : y;
        return { n, type: 'open', answer: open.answer, unsure: false };
      }
      if (x.answer === y.answer) return { n, type: x.type, answer: x.answer, unsure: false };
      return { n, type: x.type, answer: `${x.answer}/${y.answer}`, unsure: true };
    }
    const only = (x ?? y) as Answer;
    return { n, type: only.type, answer: only.answer, unsure: false };
  });
}

/** "1.a  2.c  3.b/c ?  4.V  5. El agua hierve a 100 °C." */
export function formatAnswers(merged: MergedAnswer[]): string {
  return merged
    .map((m) => {
      if (m.type === 'open') return `${m.n}. ${m.answer}`;
      return `${m.n}.${m.answer}${m.unsure ? ' ?' : ''}`;
    })
    .join('  ');
}

/** The instruction sent to every model, with the image. */
export const PROMPT = [
  'You are helping students check homework and practice tests.',
  'Look at the photo and answer EVERY question you can read in it, in order.',
  'Reply with JSON only: an array of objects {"n": <question number>, "type": "mc" | "tf" | "open", "answer": <string>}.',
  '- "mc" (multiple choice): answer is the option letter only, lowercase, e.g. "b".',
  '- "tf" (true/false, verdadero/falso): answer is "V" or "F".',
  '- "open": a short answer in simple Spanish, at most 12 words. No explanations.',
  'Use the question numbers printed on the page; if there are none, number them 1, 2, 3… from top to bottom.',
  'If the photo is unreadable or has no questions, reply with [].',
  'Example: [{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"tf","answer":"V"},{"n":3,"type":"open","answer":"El agua hierve a 100 °C."}]',
].join('\n');
