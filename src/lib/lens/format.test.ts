import { describe, expect, it } from 'vitest';
import { format05, formatResolution, formatZoom } from './format';

describe('format', () => {
  it('formats resolution with megapixels and a Spanish comma', () => {
    expect(formatResolution(4032, 3024)).toBe('4032 × 3024 px · 12,2 MP');
  });

  it('formats zoom values', () => {
    expect(formatZoom(0.5)).toBe('0,5x');
    expect(formatZoom(1)).toBe('1x');
    expect(formatZoom(0.6000001)).toBe('0,6x');
  });

  it('formats the 0.5x flag', () => {
    expect(format05(true)).toBe('0.5x: sí');
    expect(format05(false)).toBe('0.5x: no');
  });
});
