import { describe, expect, it } from 'vitest';
import { parseAnswerLine } from './answerLines';

describe('parseAnswerLine', () => {
  it('gives one item per question, keeping open sentences whole', () => {
    expect(parseAnswerLine('1.a  2.c  3.b/c ?  4.V  5. El agua hierve a 100 °C.')).toEqual([
      { n: 1, text: 'a', unsure: false },
      { n: 2, text: 'c', unsure: false },
      { n: 3, text: 'b/c', unsure: true },
      { n: 4, text: 'V', unsure: false },
      { n: 5, text: 'El agua hierve a 100 °C.', unsure: false },
    ]);
  });

  it('keeps single spaces and numbers inside open answers', () => {
    expect(parseAnswerLine('16. El corazón.  17. 50  18. Para frenar el avión al aterrizar.')).toEqual([
      { n: 16, text: 'El corazón.', unsure: false },
      { n: 17, text: '50', unsure: false },
      { n: 18, text: 'Para frenar el avión al aterrizar.', unsure: false },
    ]);
  });

  it('returns null for messages that are not answers', () => {
    expect(parseAnswerLine('No se lee bien, repite la foto')).toBeNull();
    expect(parseAnswerLine('Límite de IA alcanzado, prueba en 5 min')).toBeNull();
    expect(parseAnswerLine('')).toBeNull();
  });
});
