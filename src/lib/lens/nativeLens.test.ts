import { describe, expect, it } from 'vitest';
import { type NativeLensInfo, neutralZoom, pickNativeLens } from './nativeLens';

const dev = (over: Partial<NativeLensInfo>): NativeLensInfo => ({
  id: 'id',
  localizedName: 'Camera',
  type: 'wide-angle',
  position: 'back',
  isVirtualDevice: false,
  physicalDevices: [],
  minZoom: 1,
  maxZoom: 10,
  zoomLensSwitchFactors: [],
  ...over,
});

const uwPhys = { id: 'p2', localizedName: 'UW', type: 'ultra-wide-angle' as const };
const widePhys = { id: 'p0', localizedName: 'W', type: 'wide-angle' as const };

describe('pickNativeLens', () => {
  it('prefers a physical ultra-wide camera', () => {
    const devices = [
      dev({ id: 'front', position: 'front' }),
      dev({ id: 'main' }),
      dev({ id: 'uw', type: 'ultra-wide-angle', minZoom: 1 }),
    ];
    const pick = pickNativeLens(devices);
    expect(pick?.device.id).toBe('uw');
    expect(pick?.reason).toBe('ultra-wide-physical');
    expect(pick?.zoom).toBe(1);
    expect(pick?.is05).toBe(true);
  });

  it('uses a logical multi-camera at its minimum zoom (0.5x)', () => {
    const devices = [
      dev({ id: 'tele', type: 'telephoto' }),
      dev({ id: 'logical', isVirtualDevice: true, physicalDevices: [widePhys], minZoom: 0.6 }),
      dev({ id: 'logical2', isVirtualDevice: true, minZoom: 0.5 }),
    ];
    const pick = pickNativeLens(devices);
    expect(pick?.device.id).toBe('logical2');
    expect(pick?.zoom).toBe(0.5);
    expect(pick?.reason).toBe('multi-camera-min-zoom');
    expect(pick?.is05).toBe(true);
  });

  it('uses a virtual camera that contains the ultra-wide', () => {
    const devices = [
      dev({ id: 'main' }),
      dev({ id: 'triple', type: 'triple', isVirtualDevice: true, physicalDevices: [uwPhys, widePhys] }),
    ];
    const pick = pickNativeLens(devices);
    expect(pick?.device.id).toBe('triple');
    expect(pick?.reason).toBe('virtual-with-ultra-wide');
    expect(pick?.is05).toBe(true);
  });

  it('falls back to the widest available back camera with is05 = false', () => {
    const devices = [dev({ id: 'tele', type: 'telephoto' }), dev({ id: 'main' })];
    const pick = pickNativeLens(devices);
    expect(pick?.device.id).toBe('main');
    expect(pick?.reason).toBe('widest-available');
    expect(pick?.is05).toBe(false);
  });

  it('ignores front cameras and returns undefined without a back camera', () => {
    expect(pickNativeLens([dev({ position: 'front', type: 'ultra-wide-angle' })])).toBeUndefined();
  });
});

describe('neutralZoom', () => {
  it('is 1 for an Android logical camera whose min zoom is below 1', () => {
    expect(neutralZoom(dev({ minZoom: 0.5 }))).toBe(1);
  });

  it('is the first lens-switch factor for a virtual camera starting on the ultra-wide', () => {
    expect(
      neutralZoom(
        dev({ isVirtualDevice: true, physicalDevices: [uwPhys, widePhys], zoomLensSwitchFactors: [2, 6] }),
      ),
    ).toBe(2);
  });

  it('is the min zoom for a plain physical camera', () => {
    expect(neutralZoom(dev({ minZoom: 1 }))).toBe(1);
  });
});
