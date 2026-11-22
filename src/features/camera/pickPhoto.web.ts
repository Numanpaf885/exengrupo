/** Web / iPhone: pick an existing photo (Photos, Files or the computer) to send it for answers. */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

function chooseImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    const done = (file: File | null) => {
      resolve(file);
      input.remove();
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    // Safari fires no event when the picker is dismissed; a pending promise is harmless.
    input.addEventListener('cancel', () => done(null));
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickPhoto(): Promise<PickedPhoto | null> {
  const file = await chooseImage();
  if (!file) return null;
  const uri = URL.createObjectURL(file);
  const img = new Image();
  img.src = uri;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(uri);
    throw new Error('No se pudo leer la foto.');
  }
  return { uri, width: img.naturalWidth, height: img.naturalHeight };
}
