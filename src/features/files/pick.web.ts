/** Web / iPhone: a file input (documents or photos). Images are shrunk to a ≤ 2000 px JPEG first. */
import { compressPhoto } from '@/lib/photo/compress';
import { ACCEPT_ATTR, type PickedFile } from './picked';

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_ATTR;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    // Safari fires no event when the picker is dismissed; a stale promise is harmless.
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickFile(): Promise<PickedFile | null> {
  const file = await chooseFile();
  if (!file) return null;
  if (/^image\/(jpeg|png|heic|heif|webp)$/.test(file.type) || /\.(png|jpe?g|heic)$/i.test(file.name)) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const small = await compressPhoto(url, img.naturalWidth, img.naturalHeight);
      const blob = small.blob ?? (await (await fetch(small.uri)).blob());
      return { name: file.name.replace(/\.(png|jpe?g|heic|heif|webp)$/i, '') + '.jpg', size: blob.size, mime: 'image/jpeg', blob };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return { name: file.name, size: file.size, mime: file.type || 'application/octet-stream', blob: file };
}
