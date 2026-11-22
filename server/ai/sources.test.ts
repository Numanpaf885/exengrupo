import { describe, expect, it } from 'vitest';
import type { Answer } from './answers';
import { answerLabels, decodeSources, encodeSources, mergeSources, modelProviders } from './sources';

const mc = (n: number, answer: string): Answer => ({ n, type: 'mc', answer });
const open = (n: number, answer: string): Answer => ({ n, type: 'open', answer });

describe('which AI gave each answer', () => {
  it('follows the merge rules: agree, disagree, only one, open text', () => {
    const s = mergeSources([mc(1, 'a'), mc(2, 'b'), open(4, 'El corazón')], [mc(1, 'a'), mc(2, 'c'), mc(3, 'd'), open(4, 'Corazón')], 'claude', 'gemini');
    expect(encodeSources(s)).toBe('by 1:claude+gemini 2:claude=b,gemini=c 3:gemini 4:claude');
    expect(encodeSources(mergeSources([mc(1, 'a')], null, 'groq', undefined))).toBe('by 1:groq');
    expect(encodeSources(new Map())).toBe('');
  });

  it('round-trips through the models cell next to the other segments', () => {
    const models = 'claude:opus, gemini:flash | by 1:claude+gemini 2:claude=b,gemini=c | ref: libro.pdf p12';
    expect(decodeSources(models).get(2)).toEqual({ providers: ['claude', 'gemini'], split: [{ provider: 'claude', answer: 'b' }, { provider: 'gemini', answer: 'c' }] });
    expect(modelProviders(models)).toEqual(['claude', 'gemini']);
  });

  it('makes short labels per question, and labels old posts answered by one model', () => {
    const line = '1.a  2.b/c ?  3. El agua hierve a 100 °C.';
    expect(answerLabels(line, 'claude:opus, gemini:flash | by 1:claude+gemini 2:claude=b,gemini=c 3:claude')).toEqual({
      1: 'Claude + Gemini',
      2: 'Claude: b · Gemini: c',
      3: 'Claude',
    });
    expect(answerLabels('1.c  2.V', 'groq:qwen/qwen3.8-27b')).toEqual({ 1: 'Groq', 2: 'Groq' });
    expect(answerLabels('1.c  2.V', 'groq:a, gemini:b')).toEqual({});
    expect(answerLabels('No se lee bien, repite la foto', 'groq:a')).toEqual({});
  });
});
