/**
 * Web (iPhone Safari) camera for a space: picks the ultra-wide by label (EN/ES),
 * else a dual-wide/triple at minimum zoom, else the default back camera, and
 * captures one frame at full track resolution. The phone's own camera app is
 * offered too.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { CameraStreams } from '@/lib/lens/cameraStreams';
import { useReleaseCamera } from '@/lib/lens/useReleaseCamera';
import { pickWebLens, type WebPick } from '@/lib/lens/webLens';
import { colors, space } from '@/theme/tokens';
import { CameraChrome, type CameraChromeHandle } from './CameraChrome';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

type ZoomCaps = MediaTrackCapabilities & {
  zoom?: { min: number; max: number };
};

interface Props {
  onPhoto: (p: CapturedPhoto) => void;
  onBack: () => void;
  /** The space the photo is for (kept while the phone's camera app is open). */
  spaceId: string;
  busy?: boolean;
  /** Shown above the shutter, e.g. "Preparando la foto…" or an error. */
  notice?: string | null;
}

export function PhotoCapture({ onPhoto, onBack, busy, notice }: Props) {
  const chrome = useRef<CameraChromeHandle>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pick, setPick] = useState<WebPick | null>(null);
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Every stream this screen opens, so all of them can be turned off.
  const streams = useRef(new CameraStreams<MediaStream>()).current;

  const released = useCallback(() => {
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  }, []);
  useReleaseCamera(streams, released);

  const open = useCallback(async () => {
    // One start at a time: a second tap during startup used to leave a camera running.
    if (startingRef.current || streams.isClosed) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      startingRef.current = false;
      setStarting(false);
      setError('Este navegador no permite usar la cámara. Usa la cámara del teléfono.');
      return;
    }
    try {
      const probe = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      if (!streams.add(probe)) return; // the screen closed meanwhile
      const defaultId = probe.getVideoTracks()[0]?.getSettings().deviceId;
      const cams = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      streams.stop(probe);
      const chosen = pickWebLens(cams, defaultId);
      if (!chosen) throw new Error('no camera');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: chosen.device.deviceId },
          width: { ideal: 4096 },
          height: { ideal: 4096 },
        },
      });
      if (!streams.add(stream)) return;
      if (streamRef.current) streams.stop(streamRef.current);
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as ZoomCaps;
      if (caps.width?.max && caps.height?.max) {
        await track
          .applyConstraints({
            width: { ideal: caps.width.max },
            height: { ideal: caps.height.max },
          })
          .catch(() => undefined);
      }
      if (chosen.kind === 'virtual-wide' && caps.zoom) {
        await track
          .applyConstraints({
            advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet],
          })
          .catch(() => undefined);
      }
      if (streams.isClosed) return;
      streamRef.current = stream;
      setPick(chosen);
      setLive(true);
    } catch (e) {
      if (streams.isClosed) return;
      const denied = e instanceof DOMException && e.name === 'NotAllowedError';
      setError(
        denied
          ? 'Permiso de cámara denegado. Actívalo en Ajustes > Safari > Cámara, o usa la cámara del teléfono.'
          : 'No se pudo abrir la cámara. Usa la cámara del teléfono.',
      );
    } finally {
      startingRef.current = false;
      if (!streams.isClosed) setStarting(false);
    }
  }, [streams]);

  useEffect(() => {
    void open();
  }, [open]);

  useEffect(() => {
    const v = videoRef.current;
    if (live && v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => undefined);
    }
  }, [live]);

  const take = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    chrome.current?.flash();
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    // The frame is copied: turn the camera (and its indicator) off right away.
    streams.stopAll();
    released();
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError('No se pudo tomar la foto.');
        onPhoto({
          uri: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
        });
      },
      'image/jpeg',
      0.92,
    );
  };

  const systemCamera = () => {
    streams.stopAll();
    released();
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
      onPhoto({ uri: url, width: img.naturalWidth, height: img.naturalHeight });
    } catch {
      setError('No se pudo leer la foto.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <CameraChrome
        ref={chrome}
        onBack={onBack}
        lens={pick ? (pick.is05 ? '0.5x' : '0.5x no disponible') : null}
        busy={busy}
        message={
          notice ??
          error ??
          (pick && !pick.is05 ? 'Si tu teléfono tiene 0.5x, usa la cámara del teléfono y elígelo allí.' : null)
        }
        onShutter={live ? take : null}
        onSystemCamera={systemCamera}
        preview={
          live ? (
            <video ref={videoRef} playsInline muted autoPlay style={videoStyle} />
          ) : starting ? (
            <View style={styles.center}>
              <Text style={styles.onBlack}>Abriendo cámara…</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Button label="Abrir cámara" onPress={() => void open()} disabled={busy} />
            </View>
          )
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </>
  );
}

// Fills the preview area; "contain" shows exactly the frame that will be captured.
const videoStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  backgroundColor: colors.black,
  objectFit: 'contain',
} as const;

const styles = StyleSheet.create({
  center: { padding: space(2), gap: space(2) },
  onBlack: { color: colors.white },
});
