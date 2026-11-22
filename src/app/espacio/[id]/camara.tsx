import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { type CapturedPhoto, PhotoCapture } from '@/features/camera/PhotoCapture';
import { startUpload } from '@/features/spaces/uploads';
import { compressPhoto } from '@/lib/photo/compress';

/**
 * Full-screen camera inside a space. Taking a photo closes the camera at once;
 * compression (long edge ≤ 2000 px, JPEG, < 3 MB) and the upload continue in
 * the background while the feed shows the photo's progress.
 */
export default function Camara() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token } = useAuth();
  const router = useRouter();
  const done = useRef(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/espacio/${spaceId}`));

  const onPhoto = (photo: CapturedPhoto) => {
    if (!token || done.current) return;
    done.current = true;
    const prepare = async () => {
      try {
        return await compressPhoto(photo.uri, photo.width, photo.height);
      } finally {
        // Web: free the full-size capture once the small JPEG exists.
        if (photo.uri.startsWith('blob:')) URL.revokeObjectURL(photo.uri);
      }
    };
    startUpload(spaceId, prepare, token);
    back();
  };

  return <PhotoCapture onPhoto={onPhoto} onBack={back} />;
}
