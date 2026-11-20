import { describe, expect, it } from 'vitest';
import { exifNumber, formatFocal, lensFromExif } from './exif';

describe('exifNumber', () => {
  it('parses numbers, decimals and rationals', () => {
    expect(exifNumber(16)).toBe(16);
    expect(exifNumber('5.43')).toBe(5.43);
    expect(exifNumber('543/100')).toBe(5.43);
  });

  it('rejects junk, zero and division by zero', () => {
    expect(exifNumber('abc')).toBeUndefined();
    expect(exifNumber(0)).toBeUndefined();
    expect(exifNumber('1/0')).toBeUndefined();
    expect(exifNumber(undefined)).toBeUndefined();
  });
});

describe('lensFromExif', () => {
  it('flags an ultra-wide photo (16 mm equivalent)', () => {
    expect(lensFromExif({ FocalLengthIn35mmFilm: 16, FocalLength: '1.79' })).toEqual({
      focal35: 16,
      focalMm: 1.79,
      is05: true,
    });
  });

  it('flags a main-camera photo (26 mm equivalent)', () => {
    expect(lensFromExif({ FocalLengthIn35mmFilm: 26 }).is05).toBe(false);
  });

  it('cannot tell without the 35 mm value', () => {
    expect(lensFromExif({ FocalLength: 5.43 }).is05).toBeNull();
    expect(lensFromExif(null).is05).toBeNull();
  });
});

describe('formatFocal', () => {
  it('formats both values with a Spanish comma', () => {
    expect(formatFocal({ focal35: 15.6, focalMm: 1.79, is05: true })).toBe(
      '16 mm (equiv. 35 mm) · 1,8 mm reales',
    );
  });

  it('says when there is no data', () => {
    expect(formatFocal({ is05: null })).toBe('sin datos');
  });
});
