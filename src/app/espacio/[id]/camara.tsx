import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { type CapturedPhoto, PhotoCapture } from '@/features/camera/PhotoCapture';
import { startUpload } from '@/features/spaces/uploads';
import { compressPhoto } from '@/lib/photo/compress';

/**
 * Full-screen camera inside a space. The photo is shrunk here first (long edge
 * ≤ 2000 px, JPEG, < 3 MB: about a second, "Preparando la foto…"), while the
 * camera's own file certainly still exists; then the upload continues in the
 * background and the feed shows its progress.
 */
export default function Camara() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/espacio/${spaceId}`));

  const onPhoto = async (photo: CapturedPhoto) => {
    if (!token || working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const ready = await compressPhoto(photo.uri, photo.width, photo.height);
      startUpload(spaceId, async () => ready, token);
      back();
    } catch {
      setError('No se pudo preparar la foto. Prueba de nuevo.');
      working.current = false;
      setBusy(false);
    } finally {
      // Web: free the full-size capture once the small JPEG exists.
      if (photo.uri.startsWith('blob:')) URL.revokeObjectURL(photo.uri);
    }
  };

  return (
    <PhotoCapture
      spaceId={spaceId}
      onPhoto={(p) => void onPhoto(p)}
      onBack={back}
      busy={busy}
      notice={busy ? 'Preparando la foto…' : error}
    />
  );
}
