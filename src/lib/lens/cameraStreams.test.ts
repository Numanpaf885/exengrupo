import { describe, expect, it } from 'vitest';
import { CameraStreams } from './cameraStreams';

function fakeStream() {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  return { tracks, getTracks: () => tracks, get stopped() { return tracks.every((t) => t.stopped); } };
}

describe('CameraStreams', () => {
  it('stops every stream it was given, including a second one', () => {
    const streams = new CameraStreams();
    const a = fakeStream();
    const b = fakeStream();
    streams.add(a);
    streams.add(b);
    streams.stopAll();
    expect(a.stopped && b.stopped).toBe(true);
    expect(streams.size).toBe(0);
  });

  it('stops a stream that arrives after the screen closed (slow camera start)', () => {
    const streams = new CameraStreams();
    streams.close();
    const late = fakeStream();
    expect(streams.add(late)).toBe(false);
    expect(late.stopped).toBe(true);
  });

  it('stops one stream on its own, and works again after reopen', () => {
    const streams = new CameraStreams();
    const probe = fakeStream();
    const cam = fakeStream();
    streams.add(probe);
    streams.add(cam);
    streams.stop(probe);
    expect(probe.stopped).toBe(true);
    expect(cam.stopped).toBe(false);
    streams.close();
    expect(cam.stopped).toBe(true);
    streams.reopen();
    const again = fakeStream();
    expect(streams.add(again)).toBe(true);
    expect(again.stopped).toBe(false);
  });
});
