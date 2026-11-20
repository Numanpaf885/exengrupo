/**
 * Minimal JPEG EXIF reader for the web build. Extracts only the two tags the
 * lens check needs: FocalLength (0x920A) and FocalLengthIn35mmFilm (0xA405).
 * Returns {} for anything that is not a JPEG with an EXIF block.
 */

export interface JpegFocalTags {
  FocalLength?: number;
  FocalLengthIn35mmFilm?: number;
}

const TAG_EXIF_IFD = 0x8769;
const TAG_FOCAL_LENGTH = 0x920a;
const TAG_FOCAL_35MM = 0xa405;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

export function readJpegFocalTags(buffer: ArrayBuffer): JpegFocalTags {
  try {
    return parse(new DataView(buffer));
  } catch {
    return {};
  }
}

function parse(view: DataView): JpegFocalTags {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) return {};
    const size = view.getUint16(offset + 2);
    // APP1 with "Exif\0\0"
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0) {
      return parseTiff(view, offset + 10);
    }
    if (marker === 0xffda) return {}; // start of scan: no EXIF before image data
    offset += 2 + size;
  }
  return {};
}

function parseTiff(view: DataView, tiff: number): JpegFocalTags {
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return {};
  const le = order === 0x4949;
  const u16 = (o: number) => view.getUint16(tiff + o, le);
  const u32 = (o: number) => view.getUint32(tiff + o, le);
  if (u16(2) !== 42) return {};

  const readIfd = (ifd: number, onEntry: (tag: number, type: number, entry: number) => void) => {
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      onEntry(u16(entry), u16(entry + 2), entry);
    }
  };

  let exifIfd: number | undefined;
  readIfd(u32(4), (tag, type, entry) => {
    if (tag === TAG_EXIF_IFD && type === TYPE_LONG) exifIfd = u32(entry + 8);
  });
  if (exifIfd === undefined) return {};

  const out: JpegFocalTags = {};
  readIfd(exifIfd, (tag, type, entry) => {
    if (tag === TAG_FOCAL_LENGTH && type === TYPE_RATIONAL) {
      const at = u32(entry + 8);
      const den = u32(at + 4);
      if (den > 0) out.FocalLength = u32(at) / den;
    } else if (tag === TAG_FOCAL_35MM && type === TYPE_SHORT) {
      out.FocalLengthIn35mmFilm = u16(entry + 8);
    }
  });
  return out;
}
