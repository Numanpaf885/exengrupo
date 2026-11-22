import { describe, expect, it } from 'vitest';
import { buildFromTag, currentBuild, newerRelease } from './version';

const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets: [{ name: 'exengrupo.apk', browser_download_url: `https://github.com/x/releases/download/${tag}/exengrupo.apk` }],
  ...extra,
});

describe('Android update check', () => {
  it('reads the build number of this APK (0 for dev builds)', () => {
    expect(currentBuild('34')).toBe(34);
    expect(currentBuild(undefined)).toBe(0);
    expect(currentBuild('abc')).toBe(0);
  });

  it('reads build numbers from release tags', () => {
    expect(buildFromTag('build-40')).toBe(40);
    expect(buildFromTag('v1.0')).toBeNull();
    expect(buildFromTag(undefined)).toBeNull();
  });

  it('offers only a newer build with an APK attached', () => {
    expect(newerRelease(release('build-40'), 34)).toEqual({
      build: 40,
      url: 'https://github.com/x/releases/download/build-40/exengrupo.apk',
    });
    expect(newerRelease(release('build-34'), 34)).toBeNull();
    expect(newerRelease(release('build-30'), 34)).toBeNull();
    expect(newerRelease(release('build-40', { assets: [] }), 34)).toBeNull();
    expect(newerRelease(release('build-40', { prerelease: true }), 34)).toBeNull();
  });

  it('never prompts on dev builds or with a bad reply', () => {
    expect(newerRelease(release('build-40'), 0)).toBeNull();
    expect(newerRelease(null, 34)).toBeNull();
    expect(newerRelease({ message: 'API rate limit exceeded' }, 34)).toBeNull();
  });
});
