import { describe, expect, it } from 'vitest';
import { readJpegFocalTags } from './jpegExif';

/** Builds a tiny JPEG: SOI, APP1 Exif (IFD0 -> Exif IFD with the focal tags), EOI. */
function makeJpeg(littleEndian: boolean, focal: [number, number], focal35: number): ArrayBuffer {
  const tiff = new DataView(new ArrayBuffer(64));
  const w16 = (o: number, v: number) => tiff.setUint16(o, v, littleEndian);
  const w32 = (o: number, v: number) => tiff.setUint32(o, v, littleEndian);
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  w16(2, 42);
  w32(4, 8); // IFD0 at 8
  w16(8, 1); // 1 entry
  w16(10, 0x8769); // Exif IFD pointer
  w16(12, 4); // LONG
  w32(14, 1);
  w32(18, 26); // Exif IFD at 26
  w32(22, 0); // next IFD
  w16(26, 2); // 2 entries
  w16(28, 0x920a); // FocalLength
  w16(30, 5); // RATIONAL
  w32(32, 1);
  w32(36, 56); // value at 56
  w16(40, 0xa405); // FocalLengthIn35mmFilm
  w16(42, 3); // SHORT
  w32(44, 1);
  w16(48, focal35);
  w32(52, 0);
  w32(56, focal[0]);
  w32(60, focal[1]);

  const app1Len = 2 + 6 + tiff.byteLength;
  const out = new Uint8Array(2 + 2 + app1Len + 2);
  const v = new DataView(out.buffer);
  v.setUint16(0, 0xffd8);
  v.setUint16(2, 0xffe1);
  v.setUint16(4, app1Len);
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6);
  out.set(new Uint8Array(tiff.buffer), 12);
  v.setUint16(out.length - 2, 0xffd9);
  return out.buffer;
}

describe('readJpegFocalTags', () => {
  it('reads little-endian (Android) EXIF', () => {
    expect(readJpegFocalTags(makeJpeg(true, [179, 100], 16))).toEqual({
      FocalLength: 1.79,
      FocalLengthIn35mmFilm: 16,
    });
  });

  it('reads big-endian (iPhone) EXIF', () => {
    expect(readJpegFocalTags(makeJpeg(false, [154, 100], 13))).toEqual({
      FocalLength: 1.54,
      FocalLengthIn35mmFilm: 13,
    });
  });

  it('returns {} for non-JPEG or truncated data', () => {
    expect(readJpegFocalTags(new Uint8Array([1, 2, 3, 4]).buffer)).toEqual({});
    expect(readJpegFocalTags(makeJpeg(true, [1, 1], 26).slice(0, 20))).toEqual({});
  });
});
