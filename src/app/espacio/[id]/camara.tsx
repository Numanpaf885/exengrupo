import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type CapturedPhoto, PhotoCapture } from '@/features/camera/PhotoCapture';
import { startUpload } from '@/features/spaces/uploads';
import { compressPhoto } from '@/lib/photo/compress';

export default function Camara() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPhoto = async (photo: CapturedPhoto) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      // Long edge ≤ 2000 px, JPEG, < 3 MB — then send in the background and go back to the feed.
      const ready = await compressPhoto(photo.uri, photo.width, photo.height);
      startUpload(spaceId, ready, token);
      router.back();
    } catch {
      setError('No se pudo preparar la foto. Prueba de nuevo.');
      setBusy(false);
    }
  };

  return (
    <Screen onBack={() => router.back()}>
      <Text variant="title">Foto de las preguntas</Text>
      <Text>Encuadra todas las preguntas. Las respuestas aparecen en el espacio para todo el grupo.</Text>
      <PhotoCapture onPhoto={(p) => void onPhoto(p)} busy={busy} />
      {busy && <Text variant="label">Preparando la foto…</Text>}
      <Notice text={error} />
    </Screen>
  );
}
