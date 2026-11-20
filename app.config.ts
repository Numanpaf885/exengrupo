import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. CI sets ANDROID_VERSION_CODE (the GitHub run number) so
 * each APK has a higher versionCode and installs over the previous one.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
  },
});
