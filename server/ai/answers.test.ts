import { describe, expect, it } from 'vitest';
import { formatAnswers, mergeAnswers, parseAnswers } from './answers';

describe('parseAnswers', () => {
  it('parses the exact shape', () => {
    expect(
      parseAnswers('[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"tf","answer":"V"},{"n":3,"type":"open","answer":"Sí."}]'),
    ).toEqual([
      { n: 1, type: 'mc', answer: 'a' },
      { n: 2, type: 'tf', answer: 'V' },
      { n: 3, type: 'open', answer: 'Sí.' },
    ]);
  });

  it('tolerates code fences, extra text and messy values', () => {
    const text = 'Aquí está:\n```json\n[{"n":"2","type":"mc","answer":"(C)"},{"n":1,"type":"tf","answer":"Falso"},{"n":3,"type":"tf","answer":true}]\n```';
    expect(parseAnswers(text)).toEqual([
      { n: 1, type: 'tf', answer: 'F' },
      { n: 2, type: 'mc', answer: 'c' },
      { n: 3, type: 'tf', answer: 'V' },
    ]);
  });

  it('drops invalid items and duplicate numbers', () => {
    expect(
      parseAnswers('[{"n":1,"type":"mc","answer":"b"},{"n":1,"type":"mc","answer":"c"},{"n":0,"type":"mc","answer":"a"},{"n":2,"type":"essay","answer":"x"},{"n":3,"type":"tf","answer":"quizás"},null]'),
    ).toEqual([{ n: 1, type: 'mc', answer: 'b' }]);
  });

  it('returns [] for "nothing readable" and null for non-JSON', () => {
    expect(parseAnswers('[]')).toEqual([]);
    expect(parseAnswers('No puedo leer la imagen')).toBeNull();
    expect(parseAnswers('[oops')).toBeNull();
    expect(parseAnswers('{"n":1}')).toBeNull();
  });
});

describe('mergeAnswers + formatAnswers', () => {
  const A = parseAnswers(
    '[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"mc","answer":"c"},{"n":3,"type":"mc","answer":"b"},{"n":4,"type":"tf","answer":"V"},{"n":5,"type":"open","answer":"El agua hierve a 100 °C."}]',
  );
  const B = parseAnswers(
    '[{"n":1,"type":"mc","answer":"a"},{"n":2,"type":"mc","answer":"c"},{"n":3,"type":"mc","answer":"c"},{"n":4,"type":"tf","answer":"V"},{"n":5,"type":"open","answer":"A cien grados."}]',
  );

  it('produces exactly the display format from the brief', () => {
    expect(formatAnswers(mergeAnswers(A, B))).toBe('1.a  2.c  3.b/c ?  4.V  5. El agua hierve a 100 °C.');
  });

  it('uses the single answer when only one model answered a question', () => {
    const a = parseAnswers('[{"n":1,"type":"mc","answer":"a"}]');
    const b = parseAnswers('[{"n":2,"type":"tf","answer":"F"}]');
    expect(formatAnswers(mergeAnswers(a, b))).toBe('1.a  2.F');
    expect(formatAnswers(mergeAnswers(null, b))).toBe('2.F');
  });

  it('flags a true/false disagreement', () => {
    const a = parseAnswers('[{"n":1,"type":"tf","answer":"V"}]');
    const b = parseAnswers('[{"n":1,"type":"tf","answer":"F"}]');
    expect(formatAnswers(mergeAnswers(a, b))).toBe('1.V/F ?');
  });

  it('uses the open answer even if the other model chose a letter', () => {
    const a = parseAnswers('[{"n":1,"type":"mc","answer":"a"}]');
    const b = parseAnswers('[{"n":1,"type":"open","answer":"Mitosis."}]');
    expect(formatAnswers(mergeAnswers(a, b))).toBe('1. Mitosis.');
  });

  it('is empty when nothing was answered', () => {
    expect(formatAnswers(mergeAnswers([], null))).toBe('');
  });
});
