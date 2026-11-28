/**
 * Android: downloads the photo and saves it in the phone's gallery
 * (expo-media-library, write-only permission, asked the first time).
 * Returns the message to show.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';

export async function savePhoto(url: string, name: string): Promise<string> {
  const perm = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
  if (!perm.granted) return 'Sin permiso para guardar fotos. Actívalo en los ajustes del teléfono.';
  const target = `${FileSystem.cacheDirectory}${name}.jpg`;
  try {
    const res = await FileSystem.downloadAsync(url, target);
    if (res.status !== 200) return 'No se pudo descargar la foto. Prueba de nuevo.';
    await MediaLibrary.saveToLibraryAsync(res.uri);
    return 'Foto guardada en la galería.';
  } catch {
    return 'No se pudo guardar la foto. Prueba de nuevo.';
  } finally {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
  }
}
