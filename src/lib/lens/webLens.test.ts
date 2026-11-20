import { describe, expect, it } from 'vitest';
import {
  isBackLabel,
  isUltraWideLabel,
  isVirtualWideLabel,
  normalizeLabel,
  pickWebLens,
  webBackCameras,
} from './webLens';

const cam = (deviceId: string, label: string) => ({ deviceId, label });

const iphoneEn = [
  cam('f', 'Front Camera'),
  cam('w', 'Back Camera'),
  cam('t', 'Back Telephoto Camera'),
  cam('dual', 'Back Dual Camera'),
  cam('dw', 'Back Dual Wide Camera'),
  cam('tri', 'Back Triple Camera'),
  cam('uw', 'Back Ultra Wide Camera'),
];

const iphoneEs = [
  cam('f', 'Cámara frontal'),
  cam('w', 'Cámara trasera'),
  cam('dw', 'Cámara trasera doble gran angular'),
  cam('tri', 'Cámara trasera triple'),
  cam('uw', 'Cámara trasera ultra gran angular'),
];

describe('normalizeLabel', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeLabel('  Cámara   ULTRA Gran Angular ')).toBe('camara ultra gran angular');
  });
});

describe('label matching', () => {
  it.each([
    'Back Ultra Wide Camera',
    'Cámara ultra gran angular',
    'Cámara ultra gran angular posterior',
    'Cámara trasera ultragran angular',
    'Ultra-Wide back',
  ])('detects ultra-wide: %s', (label) => {
    expect(isUltraWideLabel(label)).toBe(true);
  });

  it.each(['Back Camera', 'Back Dual Wide Camera', 'Cámara trasera', 'Back Telephoto Camera'])(
    'is not ultra-wide: %s',
    (label) => {
      expect(isUltraWideLabel(label)).toBe(false);
    },
  );

  it.each([
    'Back Dual Wide Camera',
    'Back Triple Camera',
    'Cámara trasera triple',
    'Cámara doble gran angular',
    'Cámara gran angular dual',
  ])('detects virtual wide: %s', (label) => {
    expect(isVirtualWideLabel(label)).toBe(true);
  });

  it('does not treat a plain dual (wide+tele) camera as virtual wide', () => {
    expect(isVirtualWideLabel('Back Dual Camera')).toBe(false);
  });

  it('separates front from back', () => {
    expect(isBackLabel('Front Camera')).toBe(false);
    expect(isBackLabel('Cámara frontal')).toBe(false);
    expect(isBackLabel('Back Camera')).toBe(true);
    expect(isBackLabel('camera2 0, facing back')).toBe(true);
  });
});

describe('webBackCameras', () => {
  it('drops the front camera', () => {
    expect(webBackCameras(iphoneEn).map((c) => c.deviceId)).toEqual([
      'w',
      't',
      'dual',
      'dw',
      'tri',
      'uw',
    ]);
  });

  it('falls back to every non-front camera when labels have no position', () => {
    const laptop = [cam('a', 'FaceTime HD Camera'), cam('b', 'USB Webcam')];
    expect(webBackCameras(laptop).map((c) => c.deviceId)).toEqual(['b']);
  });
});

describe('pickWebLens', () => {
  it('picks the ultra-wide camera on an English iPhone', () => {
    expect(pickWebLens(iphoneEn)).toEqual({ device: iphoneEn[6], kind: 'ultra-wide', is05: true });
  });

  it('picks the ultra-wide camera on a Spanish iPhone', () => {
    expect(pickWebLens(iphoneEs)?.device.deviceId).toBe('uw');
    expect(pickWebLens(iphoneEs)?.is05).toBe(true);
  });

  it('uses a virtual dual-wide/triple camera when there is no ultra-wide', () => {
    const cams = [cam('w', 'Back Camera'), cam('tri', 'Back Triple Camera')];
    expect(pickWebLens(cams)).toEqual({ device: cams[1], kind: 'virtual-wide', is05: false });
  });

  it('uses the default back camera when nothing wider exists', () => {
    const cams = [cam('f', 'Front Camera'), cam('w', 'Back Camera'), cam('t', 'Back Telephoto Camera')];
    expect(pickWebLens(cams, 't')).toEqual({ device: cams[2], kind: 'default', is05: false });
    expect(pickWebLens(cams)?.device.deviceId).toBe('w');
  });

  it('returns undefined when there are no cameras', () => {
    expect(pickWebLens([])).toBeUndefined();
  });
});
