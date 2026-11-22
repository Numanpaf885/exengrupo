/**
 * Android: while the phone's own camera app is open, Android (MIUI in particular)
 * may close exengrupo to free memory. The photo then comes back to a fresh app
 * through ImagePicker.getPendingResultAsync(). We remember which space asked for
 * it so the photo can still be sent there.
 */
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

const KEY = 'exengrupo.pendingCameraSpace';

export async function rememberCameraSpace(spaceId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, spaceId).catch(() => undefined);
}

export async function forgetCameraSpace(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}

export interface RecoveredPhoto {
  spaceId: string;
  uri: string;
  width: number;
  height: number;
}

/** A photo taken in the phone's camera app after Android closed exengrupo, or null. */
export async function recoverCameraPhoto(): Promise<RecoveredPhoto | null> {
  try {
    const spaceId = await SecureStore.getItemAsync(KEY);
    if (!spaceId) return null;
    const pending = await ImagePicker.getPendingResultAsync();
    await forgetCameraSpace();
    if (!pending || !('assets' in pending) || pending.canceled || !pending.assets?.[0]) return null;
    const a = pending.assets[0];
    return { spaceId, uri: a.uri, width: a.width, height: a.height };
  } catch {
    return null;
  }
}
