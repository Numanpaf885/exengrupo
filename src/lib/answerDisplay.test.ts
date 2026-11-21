import { describe, expect, it } from 'vitest';
import { displayAnswer } from './answerDisplay';

describe('displayAnswer', () => {
  it('glues the "?" to its answer but keeps the double spaces between answers', () => {
    expect(displayAnswer('1.a  2.c  3.b/c ?  4.V')).toBe('1.a  2.c  3.b/c ?  4.V');
  });
});
