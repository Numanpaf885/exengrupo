/** Android: the session is kept in the encrypted keystore (expo-secure-store). */
import * as SecureStore from 'expo-secure-store';

const KEY = 'exengrupo.session';

export async function loadSession(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveSession(value: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, value);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
