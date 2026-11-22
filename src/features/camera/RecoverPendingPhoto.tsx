import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { startUpload } from '@/features/spaces/uploads';
import { compressPhoto } from '@/lib/photo/compress';
import { recoverCameraPhoto } from './pendingPhoto';

/**
 * Mounted once while signed in. If Android closed the app while the phone's
 * camera app was open, the photo taken there is sent now and its space opens.
 */
export function RecoverPendingPhoto() {
  const { token } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void recoverCameraPhoto().then((photo) => {
      if (!photo || cancelled) return;
      startUpload(photo.spaceId, () => compressPhoto(photo.uri, photo.width, photo.height), token);
      router.push(`/espacio/${photo.spaceId}`);
    });
    return () => {
      cancelled = true;
    };
  }, [token, router]);
  return null;
}
