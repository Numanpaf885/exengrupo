/** Web: resize (long edge ≤ 2000 px) on a canvas and export a JPEG under 3 MB. */
import { fitWithin, MAX_BYTES, QUALITY_STEPS } from './fit';
import type { ReadyPhoto } from './types';

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function compressPhoto(uri: string, width: number, height: number): Promise<ReadyPhoto> {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const w = img.naturalWidth || width;
  const h = img.naturalHeight || height;
  const target = fitWithin(w, h) ?? { width: w, height: h };
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la foto.');
  ctx.drawImage(img, 0, 0, target.width, target.height);
  let blob: Blob | null = null;
  for (const q of QUALITY_STEPS) {
    blob = await toBlob(canvas, q);
    if (blob && blob.size < MAX_BYTES) break;
  }
  if (!blob) throw new Error('No se pudo preparar la foto.');
  return { uri: URL.createObjectURL(blob), width: target.width, height: target.height, blob };
}
