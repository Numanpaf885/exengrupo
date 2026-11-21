import { describe, expect, it } from 'vitest';
import { fitWithin, QUALITY_STEPS } from './fit';

describe('fitWithin', () => {
  it('scales the long edge down to 2000 px', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });

  it('leaves small photos alone', () => {
    expect(fitWithin(2000, 1500)).toBeNull();
    expect(fitWithin(800, 600)).toBeNull();
  });

  it('tries decreasing qualities', () => {
    expect([...QUALITY_STEPS].sort((a, b) => b - a)).toEqual(QUALITY_STEPS);
  });
});
