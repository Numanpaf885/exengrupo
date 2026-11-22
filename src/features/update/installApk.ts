/**
 * Android: downloads the new APK inside the app (with progress) and opens the
 * system installer directly, so updating is "Actualizar" here + Android's own
 * "Actualizar" confirmation. The confirmation can't be skipped for apps
 * installed outside the Play Store; the very first time, Android also asks to
 * allow installs from exengrupo (once).
 * Needs the REQUEST_INSTALL_PACKAGES permission (app.json). If anything fails,
 * falls back to downloading through the browser.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';

const FLAG_GRANT_READ_URI_PERMISSION = 1;

export async function installApk(url: string, build: number, onProgress: (pct: number) => void): Promise<void> {
  try {
    if (!FileSystem.cacheDirectory) throw new Error('no cache directory');
    const target = `${FileSystem.cacheDirectory}exengrupo-${build}.apk`;
    const task = FileSystem.createDownloadResumable(url, target, {}, (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
      }
    });
    const result = await task.downloadAsync();
    if (!result || result.status !== 200) throw new Error(`download failed (${result?.status ?? '?'})`);
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch {
    // Plan B: let the browser download it (tap the notification, then "Actualizar").
    await Linking.openURL(url);
  }
}
