import { describe, expect, it } from 'vitest';
import { displayAnswer } from './answerDisplay';

describe('displayAnswer', () => {
  it('glues the "?" to its answer but keeps the double spaces between answers', () => {
    expect(displayAnswer('1.a  2.c  3.b/c ?  4.V')).toBe('1.a  2.c  3.b/c ?  4.V');
  });
});

describe('displayAnswer units', () => {
  it('keeps numbers with their units on one line, nothing else changes', () => {
    expect(displayAnswer('5. El agua hierve a 100 °C.')).toBe('5. El agua hierve a 100 °C.');
    expect(displayAnswer('2. Un 25 % y 9,8 m/s² o 3 kg')).toBe('2. Un 25 % y 9,8 m/s² o 3 kg');
    expect(displayAnswer('1.a  2.c  4.V')).toBe('1.a  2.c  4.V');
    expect(displayAnswer('3. Son 2 fases distintas')).toBe('3. Son 2 fases distintas');
  });
});
