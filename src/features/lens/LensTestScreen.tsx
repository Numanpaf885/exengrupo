/**
 * "Prueba de lente" — Android (native) version, react-native-vision-camera v5.
 * The web build uses LensTestScreen.web.tsx instead.
 */
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  type CameraDevice,
  type CameraRef,
  useCameraDevices,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { Button } from '@/components/Button';
import { InfoRow } from '@/components/InfoRow';
import { Screen } from '@/components/Screen';
import { Shutter } from '@/components/Shutter';
import { Text } from '@/components/Text';
import { formatFocal, lensFromExif } from '@/lib/lens/exif';
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

/** A photo from our camera or from the phone's own camera app. */
interface Shot {
  uri: string;
  width: number;
  height: number;
  lens: string;
  /** null = the phone's camera app did not say which lens it used. */
  is05: boolean | null;
  focal?: string;
}

const fileUri = (path: string): string => (path.startsWith('file://') ? path : `file://${path}`);

export function LensTestScreen({ onBack }: { onBack?: () => void }) {
  const permission = useCameraPermission();
  const devices = useCameraDevices();
  const back = useMemo(() => backDevices(devices), [devices]);
  const pick = useMemo(() => pickNativeLens(devices), [devices]);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  const cameraRef = useRef<CameraRef>(null);

  const [photo, setPhoto] = useState<Shot | null>(null);
  const [aspect, setAspect] = useState(3 / 4);
  const [shownZoom, setShownZoom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  /** Our camera is released while the phone's camera app is open. */
  const [systemOpen, setSystemOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off', enableShutterSound: false }, {});
      setPhoto({
        uri: fileUri(file.filePath),
        width: file.width,
        height: file.height,
        lens: lensLabel,
        is05: pick?.is05 ?? false,
      });
    } catch (e) {
      setError(`No se pudo tomar la foto: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Opens the phone's own camera app (Android ACTION_IMAGE_CAPTURE). Some
   * phones (e.g. Xiaomi) only let their own app use the 0.6x lens.
   */
  const openSystemCamera = async () => {
    setError(null);
    setSystemOpen(true);
    try {
      // Give VisionCamera a moment to release the camera before the other app opens it.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const exifLens = lensFromExif(asset.exif);
      setPhoto({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        lens: 'Cámara del teléfono',
        is05: exifLens.is05,
        focal: formatFocal(exifLens),
      });
    } catch (e) {
      setError(`No se pudo abrir la cámara del teléfono: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSystemOpen(false);
    }
  };

  const lensLabel = pick
    ? `${pick.device.localizedName} (${pick.device.type}) · ${NATIVE_REASON_LABEL[pick.reason]} · zoom ${formatZoom(pick.zoom)}`
    : '—';

  return (
    <Screen onBack={onBack}>
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
                  isActive={!photo && !systemOpen}
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
              {!pick.is05 && (
                <Text>
                  Este teléfono no deja usar su lente ultra gran angular en otras apps. Usa la cámara del
                  teléfono y elige 0.6x o 0.5x allí.
                </Text>
              )}
              <Button label="Usar cámara del teléfono" kind="secondary" onPress={() => void openSystemCamera()} />
            </View>
          )}

          {photo && (
            <View style={styles.block}>
              <Text variant="title">Foto</Text>
              <Image
                source={{ uri: photo.uri }}
                style={[styles.photo, { aspectRatio: aspect }]}
                resizeMode="contain"
                onLoad={(e) => {
                  const { width, height } = e.nativeEvent.source;
                  if (width > 0 && height > 0) setAspect(width / height);
                }}
              />
              <InfoRow label="Lente" value={photo.lens} />
              <InfoRow label="Resolución" value={formatResolution(photo.width, photo.height)} />
              {photo.focal !== undefined && <InfoRow label="Distancia focal" value={photo.focal} />}
              <InfoRow
                label="Ultra gran angular"
                value={photo.is05 === null ? '0.5x: no se sabe' : format05(photo.is05)}
              />
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
  cameraBox: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.black },
  shutterBar: {
    backgroundColor: colors.black,
    padding: space(2),
    alignItems: 'center',
  },
  photo: { width: '100%', backgroundColor: colors.black },
});
