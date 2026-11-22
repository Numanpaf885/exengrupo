/**
 * Android: pick a reference file from documents (PDF, images, .txt, .md, .docx)
 * or from the gallery. Images are shrunk on the phone first (≤ 2000 px JPEG),
 * which is plenty for the AI to read them.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image } from 'react-native';
import { compressPhoto } from '@/lib/photo/compress';
import { ACCEPTED_MIME, type PickedFile } from './picked';

const imageSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );

async function asJpeg(uri: string, name: string, width?: number, height?: number): Promise<PickedFile> {
  const dims = width && height ? { width, height } : await imageSize(uri);
  const small = await compressPhoto(uri, dims.width, dims.height);
  const blob = await (await fetch(small.uri)).blob();
  return { name: name.replace(/\.(png|jpe?g|heic|webp)$/i, '') + '.jpg', size: blob.size, mime: 'image/jpeg', blob };
}

async function fromDocuments(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_MIME, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (/^image\//.test(a.mimeType ?? '') || /\.(png|jpe?g)$/i.test(a.name)) return asJpeg(a.uri, a.name);
  const blob = await (await fetch(a.uri)).blob();
  return { name: a.name, size: a.size ?? blob.size, mime: a.mimeType ?? 'application/octet-stream', blob };
}

async function fromGallery(): Promise<PickedFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return asJpeg(a.uri, a.fileName ?? `imagen-${Date.now()}.jpg`, a.width, a.height);
}

/** Asks "Documento" or "Galería", then opens that picker. Null when cancelled. */
export function pickFile(): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const run = (f: () => Promise<PickedFile | null>) => () => void f().then(resolve, reject);
    Alert.alert('Añadir archivo', 'PDF, Word (.docx), texto (.txt, .md) o imagen.', [
      { text: 'Documento', onPress: run(fromDocuments) },
      { text: 'Galería', onPress: run(fromGallery) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
