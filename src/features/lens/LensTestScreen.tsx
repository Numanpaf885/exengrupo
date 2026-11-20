/**
 * "Prueba de lente" — Android (native) version, react-native-vision-camera v5.
 * The web build uses LensTestScreen.web.tsx instead.
 */
import { useMemo, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  type CameraDevice,
  type CameraRef,
  type PhotoFile,
  useCameraDevices,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { Button } from '@/components/Button';
import { InfoRow } from '@/components/InfoRow';
import { Screen } from '@/components/Screen';
import { Shutter } from '@/components/Shutter';
import { Text } from '@/components/Text';
import { format05, formatResolution, formatZoom } from '@/lib/lens/format';
import { backDevices, NATIVE_REASON_LABEL, neutralZoom, pickNativeLens } from '@/lib/lens/nativeLens';
import { colors, rule, space } from '@/theme/tokens';

function DeviceList({ devices, chosenId }: { devices: CameraDevice[]; chosenId?: string }) {
  if (devices.length === 0) return <Text>No se encontró ninguna cámara trasera.</Text>;
  return (
    <View>
      {devices.map((d) => {
        const physical =
          d.physicalDevices.length > 0
            ? d.physicalDevices.map((p) => `${p.localizedName} (${p.type})`).join(', ')
            : 'ninguno (cámara física)';
        return (
          <View key={d.id} style={styles.deviceRow}>
            <Text variant="label">
              {d.localizedName}
              {d.id === chosenId ? '  · elegida' : ''}
            </Text>
            <Text>
              Tipo: {d.type} · id {d.id}
            </Text>
            <Text>Dispositivos físicos: {physical}</Text>
            <Text>
              Zoom: mín {formatZoom(d.minZoom)} · neutro {formatZoom(neutralZoom(d))} · máx{' '}
              {formatZoom(d.maxZoom)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function LensTestScreen() {
  const permission = useCameraPermission();
  const devices = useCameraDevices();
  const back = useMemo(() => backDevices(devices), [devices]);
  const pick = useMemo(() => pickNativeLens(devices), [devices]);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  const cameraRef = useRef<CameraRef>(null);

  const [photo, setPhoto] = useState<PhotoFile | null>(null);
  const [aspect, setAspect] = useState(3 / 4);
  const [shownZoom, setShownZoom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      setPhoto(file);
    } catch (e) {
      setError(`No se pudo tomar la foto: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const lensLabel = pick
    ? `${pick.device.localizedName} (${pick.device.type}) · ${NATIVE_REASON_LABEL[pick.reason]} · zoom ${formatZoom(pick.zoom)}`
    : '—';

  return (
    <Screen>
      <Text variant="display">Prueba de lente</Text>

      {!permission.hasPermission ? (
        <View style={styles.block}>
          <Text>La app necesita la cámara para probar el lente 0.5x.</Text>
          {permission.canRequestPermission ? (
            <Button label="Permitir cámara" onPress={() => void permission.requestPermission()} />
          ) : (
            <>
              <Text>Activa el permiso de cámara en Ajustes.</Text>
              <Button label="Abrir Ajustes" onPress={() => void Linking.openSettings()} />
            </>
          )}
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <Text variant="title">Cámaras traseras</Text>
            <DeviceList devices={back} chosenId={pick?.device.id} />
          </View>

          {pick && !photo && (
            <View style={styles.block}>
              <Text variant="title">Cámara</Text>
              <Text>Lente: {lensLabel}</Text>
              {!pick.is05 && <Text variant="label">0.5x no disponible</Text>}
              <View style={styles.cameraBox}>
                <Camera
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  device={pick.device}
                  isActive={!photo}
                  outputs={[photoOutput]}
                  zoom={pick.zoom}
                  resizeMode="contain"
                  onStarted={() => setShownZoom(cameraRef.current?.controller?.displayableZoomFactor ?? null)}
                  onError={(e) => setError(`Error de cámara: ${e.message}`)}
                />
              </View>
              {shownZoom != null && <Text>Zoom mostrado por el sistema: {formatZoom(shownZoom)}</Text>}
              <View style={styles.shutterBar}>
                <Shutter onPress={() => void takePhoto()} disabled={busy} />
              </View>
            </View>
          )}

          {photo && pick && (
            <View style={styles.block}>
              <Text variant="title">Foto</Text>
              <Image
                source={{ uri: photo.filePath.startsWith('file://') ? photo.filePath : `file://${photo.filePath}` }}
                style={[styles.photo, { aspectRatio: aspect }]}
                resizeMode="contain"
                onLoad={(e) => {
                  const { width, height } = e.nativeEvent.source;
                  if (width > 0 && height > 0) setAspect(width / height);
                }}
              />
              <InfoRow label="Lente" value={lensLabel} />
              <InfoRow label="Resolución" value={formatResolution(photo.width, photo.height)} />
              <InfoRow label="Ultra gran angular" value={format05(pick.is05)} />
              <Button label="Repetir" kind="secondary" onPress={() => setPhoto(null)} />
            </View>
          )}
        </>
      )}

      {error && <Text variant="label">{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space(2) },
  deviceRow: {
    borderTopWidth: rule.width,
    borderTopColor: rule.color,
    paddingTop: space(1),
    paddingBottom: space(2),
  },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.text },
  shutterBar: {
    backgroundColor: colors.text,
    paddingVertical: space(2),
    alignItems: 'center',
  },
  photo: { width: '100%', backgroundColor: colors.text },
});
