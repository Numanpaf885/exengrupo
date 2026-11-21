/** Android: resize (long edge ≤ 2000 px) and re-encode as JPEG under 3 MB. */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fitWithin, MAX_BYTES, QUALITY_STEPS } from './fit';
import type { ReadyPhoto } from './types';

async function fileSize(uri: string): Promise<number> {
  try {
    const res = await fetch(uri);
    return (await res.blob()).size;
  } catch {
    return 0;
  }
}

export async function compressPhoto(uri: string, width: number, height: number): Promise<ReadyPhoto> {
  const context = ImageManipulator.manipulate(uri);
  const target = fitWithin(width, height);
  if (target) context.resize(target);
  const image = await context.renderAsync();
  let last: ReadyPhoto | null = null;
  for (const compress of QUALITY_STEPS) {
    const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG });
    last = { uri: saved.uri, width: saved.width, height: saved.height };
    const size = await fileSize(saved.uri);
    if (size > 0 && size < MAX_BYTES) return last;
  }
  if (!last) throw new Error('No se pudo preparar la foto.');
  return last;
}
