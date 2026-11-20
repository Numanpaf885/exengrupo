/**
 * "Prueba de lente" — web version (iPhone Safari / PWA).
 * Uses getUserMedia + enumerateDevices; captures a frame from the video
 * stream at full track resolution into a canvas and exports a JPEG.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { InfoRow } from '@/components/InfoRow';
import { Screen } from '@/components/Screen';
import { Shutter } from '@/components/Shutter';
import { Text } from '@/components/Text';
import { format05, formatResolution, formatZoom } from '@/lib/lens/format';
import { pickWebLens, WEB_KIND_LABEL, type WebPick, webBackCameras } from '@/lib/lens/webLens';
import { colors, rule, space } from '@/theme/tokens';

type Phase = 'idle' | 'starting' | 'live' | 'photo';

interface Shot {
  url: string;
  width: number;
  height: number;
}

interface Cam {
  deviceId: string;
  label: string;
}

/** Zoom is not in every TS DOM lib yet. */
type ZoomCaps = MediaTrackCapabilities & { zoom?: { min: number; max: number } };

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function LensTestScreen() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [cams, setCams] = useState<Cam[]>([]);
  const [pick, setPick] = useState<WebPick<Cam> | null>(null);
  const [track, setTrack] = useState<{ width: number; height: number; zoom?: number } | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      stopStream(streamRef.current);
    },
    [],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (phase === 'live' && video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => undefined);
    }
  }, [phase]);

  const openCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara. Abre la app en Safari.');
      return;
    }
    setPhase('starting');
    try {
      // 1. Ask for permission first: labels are empty until it is granted.
      const probe = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const defaultId = probe.getVideoTracks()[0]?.getSettings().deviceId;
      const all = (await navigator.mediaDevices.enumerateDevices())
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      stopStream(probe);

      const chosen = pickWebLens(all, defaultId);
      setCams(webBackCameras(all));
      setPick(chosen ?? null);
      if (!chosen) throw new Error('No se encontró ninguna cámara.');

      // 2. Open the chosen camera, asking for as many pixels as it can give.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: chosen.device.deviceId }, width: { ideal: 4096 }, height: { ideal: 4096 } },
        audio: false,
      });
      const t = stream.getVideoTracks()[0];
      const caps = (t.getCapabilities?.() ?? {}) as ZoomCaps;
      if (caps.width?.max && caps.height?.max) {
        await t
          .applyConstraints({ width: { ideal: caps.width.max }, height: { ideal: caps.height.max } })
          .catch(() => undefined);
      }
      // 3. Virtual dual-wide/triple camera: go to its widest view (minimum zoom).
      if (chosen.kind === 'virtual-wide' && caps.zoom) {
        await t
          .applyConstraints({ advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet] })
          .catch(() => undefined);
      }
      const s = t.getSettings() as MediaTrackSettings & { zoom?: number };
      setTrack({ width: s.width ?? 0, height: s.height ?? 0, zoom: s.zoom });
      streamRef.current = stream;
      setPhase('live');
    } catch (e) {
      setPhase('idle');
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Actívalo en Ajustes > Safari > Cámara.'
          : `No se pudo abrir la cámara: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('No se pudo crear la foto.');
          return;
        }
        if (shot) URL.revokeObjectURL(shot.url);
        setShot({ url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height });
        stopStream(streamRef.current);
        streamRef.current = null;
        setPhase('photo');
      },
      'image/jpeg',
      0.92,
    );
  };

  const lensLabel = pick ? `${pick.device.label || 'sin nombre'} · ${WEB_KIND_LABEL[pick.kind]}` : '—';

  return (
    <Screen>
      <Text variant="display">Prueba de lente</Text>

      {cams.length > 0 && (
        <View style={styles.block}>
          <Text variant="title">Cámaras traseras</Text>
          <View>
            {cams.map((c) => (
              <View key={c.deviceId} style={styles.deviceRow}>
                <Text variant="label">
                  {c.label || 'Cámara sin nombre'}
                  {c.deviceId === pick?.device.deviceId ? '  · elegida' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(phase === 'idle' || phase === 'starting') && (
        <View style={styles.block}>
          <Text>Abre la cámara para ver los lentes de este teléfono y probar el 0.5x.</Text>
          <Button
            label={phase === 'starting' ? 'Abriendo…' : 'Abrir cámara'}
            onPress={() => void openCamera()}
            disabled={phase === 'starting'}
          />
        </View>
      )}

      {phase === 'live' && pick && (
        <View style={styles.block}>
          <Text variant="title">Cámara</Text>
          <Text>Lente: {lensLabel}</Text>
          {!pick.is05 && <Text variant="label">0.5x no disponible</Text>}
          {track && (
            <Text>
              Señal: {formatResolution(track.width, track.height)}
              {track.zoom != null ? ` · zoom ${formatZoom(track.zoom)}` : ''}
            </Text>
          )}
          <video ref={videoRef} playsInline muted autoPlay style={videoStyle} />
          <View style={styles.shutterBar}>
            <Shutter onPress={takePhoto} />
          </View>
        </View>
      )}

      {phase === 'photo' && shot && pick && (
        <View style={styles.block}>
          <Text variant="title">Foto</Text>
          <img src={shot.url} alt="Foto tomada" style={imgStyle} />
          <InfoRow label="Lente" value={lensLabel} />
          <InfoRow label="Resolución" value={formatResolution(shot.width, shot.height)} />
          <InfoRow label="Ultra gran angular" value={format05(pick.is05)} />
          <Button label="Repetir" kind="secondary" onPress={() => void openCamera()} />
        </View>
      )}

      {error && <Text variant="label">{error}</Text>}
    </Screen>
  );
}

const videoStyle = {
  width: '100%',
  display: 'block',
  backgroundColor: colors.text,
  objectFit: 'contain',
} as const;

const imgStyle = { width: '100%', height: 'auto', display: 'block' } as const;

const styles = StyleSheet.create({
  block: { gap: space(2) },
  deviceRow: { borderTopWidth: rule.width, borderTopColor: rule.color, paddingTop: space(1), paddingBottom: space(2) },
  shutterBar: { backgroundColor: colors.text, paddingVertical: space(2), alignItems: 'center' },
});
