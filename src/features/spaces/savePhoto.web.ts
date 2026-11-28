/**
 * Web / iPhone: the share sheet with the image file (iPhone shows "Guardar
 * imagen" there; Safari can't save to Photos any other way), or a normal
 * download where file sharing isn't available (computers).
 */
export async function savePhoto(url: string, name: string): Promise<string> {
  let blob: Blob;
  try {
    const res = await fetch(url);
    if (!res.ok) return 'No se pudo descargar la foto. Prueba de nuevo.';
    blob = await res.blob();
  } catch {
    return 'No se pudo descargar la foto. Prueba de nuevo.';
  }
  const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return '';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return '';
      // share refused: fall through to a download
    }
  }
  const link = document.createElement('a');
  const href = URL.createObjectURL(blob);
  link.href = href;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return 'Foto descargada.';
}
