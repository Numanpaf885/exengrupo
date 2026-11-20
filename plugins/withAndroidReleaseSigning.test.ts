import { describe, expect, it } from 'vitest';
const { applySigning } = require('./withAndroidReleaseSigning') as { applySigning: (s: string) => string };

const GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;

describe('applySigning', () => {
  it('adds a release signing config and uses it for release builds only', () => {
    const out = applySigning(GRADLE);
    expect(out).toContain("storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))");
    expect(out).toMatch(/debug \{\s+signingConfig signingConfigs\.debug/);
    expect(out).toMatch(/release \{\s+signingConfig signingConfigs\.release/);
  });

  it('is idempotent', () => {
    const once = applySigning(GRADLE);
    expect(applySigning(once)).toBe(once);
  });

  it('fails loudly if the template changes shape', () => {
    expect(() => applySigning('android {}')).toThrow(/signingConfigs/);
  });
});
