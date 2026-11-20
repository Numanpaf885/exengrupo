/**
 * Expo config plugin: signs the Android *release* build with our own keystore
 * so every CI build has the same signature and installs over the old version.
 *
 * At build time, if these environment variables are set, they are used:
 *   ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
 * Otherwise the release build falls back to the debug keystore that
 * `expo prebuild` writes (fine for local testing only).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// exengrupo-release-signing';

const RELEASE_SIGNING = `
        ${MARKER}
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

function applySigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;

  // 1. Add a `release` entry inside `signingConfigs { ... }`.
  const signingStart = gradle.indexOf('signingConfigs {');
  if (signingStart === -1) throw new Error('withAndroidReleaseSigning: signingConfigs block not found');
  const insertAt = signingStart + 'signingConfigs {'.length;
  gradle = gradle.slice(0, insertAt) + RELEASE_SIGNING + gradle.slice(insertAt);

  // 2. Point the release buildType at it.
  const buildTypesStart = gradle.indexOf('buildTypes {');
  const releaseStart = gradle.indexOf('release {', buildTypesStart);
  if (buildTypesStart === -1 || releaseStart === -1) {
    throw new Error('withAndroidReleaseSigning: release buildType not found');
  }
  const before = gradle.slice(0, releaseStart);
  const after = gradle.slice(releaseStart);
  const replaced = after.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
  if (replaced === after) throw new Error('withAndroidReleaseSigning: release signingConfig line not found');
  return before + replaced;
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applySigning = applySigning;
