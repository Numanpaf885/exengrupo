/**
 * Android: resize (long edge ≤ 2000 px) and re-encode as JPEG under 3 MB.
 *
 * The size of each try is measured from the encoder's own base64 output, not
 * by reading the file back: Expo's fetch (the global fetch on Android) cannot
 * read local file:// URIs; each try is a fresh save of the same decoded image.
 * The real image size comes from the decoded image (the camera's reported
 * width/height can be missing or sideways).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { base64Bytes, fitWithin, MAX_BYTES, QUALITY_STEPS } from './fit';
import type { ReadyPhoto } from './types';

export async function compressPhoto(uri: string, width: number, height: number): Promise<ReadyPhoto> {
  const decoded = await ImageManipulator.manipulate(uri).renderAsync();
  const target = fitWithin(decoded.width || width, decoded.height || height);
  const image = target ? await ImageManipulator.manipulate(uri).resize(target).renderAsync() : decoded;

  let smallest: { photo: ReadyPhoto; bytes: number } | null = null;
  for (const compress of QUALITY_STEPS) {
    const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
    const photo = { uri: saved.uri, width: saved.width, height: saved.height };
    const bytes = saved.base64 ? base64Bytes(saved.base64) : 0;
    // Unknown size: a ≤ 2000 px JPEG at this quality is far below 3 MB, so send it.
    if (bytes === 0 || bytes < MAX_BYTES) return photo;
    if (!smallest || bytes < smallest.bytes) smallest = { photo, bytes };
  }
  if (!smallest) throw new Error('No se pudo preparar la foto.');
  return smallest.photo;
}
