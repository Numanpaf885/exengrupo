/**
 * Android camera for a space: opens the ultra-wide (0.5x) when the phone exposes
 * it, otherwise the widest lens with "0.5x no disponible". The phone's own camera
 * app is offered too, for phones (e.g. Xiaomi) that hide the ultra-wide.
 */
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Camera, useCameraDevices, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Button } from '@/components/Button';
import { Shutter } from '@/components/Shutter';
import { Text } from '@/components/Text';
import { pickNativeLens } from '@/lib/lens/nativeLens';
import { colors, space } from '@/theme/tokens';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

const fileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

export function PhotoCapture({ onPhoto, busy }: { onPhoto: (p: CapturedPhoto) => void; busy?: boolean }) {
  const permission = useCameraPermission();
  const devices = useCameraDevices();
  const pick = useMemo(() => pickNativeLens(devices), [devices]);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  const [systemOpen, setSystemOpen] = useState(false);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async () => {
    setTaking(true);
    setError(null);
    try {
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      onPhoto({ uri: fileUri(file.filePath), width: file.width, height: file.height });
    } catch {
      setError('No se pudo tomar la foto. Prueba de nuevo.');
    } finally {
      setTaking(false);
    }
  };

  const systemCamera = async () => {
    setError(null);
    setSystemOpen(true);
    try {
      await new Promise((r) => setTimeout(r, 300)); // let our camera release the lens
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled) {
        const a = result.assets[0];
        onPhoto({ uri: a.uri, width: a.width, height: a.height });
      }
    } catch {
      setError('No se pudo abrir la cámara del teléfono.');
    } finally {
      setSystemOpen(false);
    }
  };

  if (!permission.hasPermission) {
    return (
      <View style={styles.block}>
        <Text>Para tomar fotos, la app necesita la cámara.</Text>
        {permission.canRequestPermission ? (
          <Button label="Permitir cámara" onPress={() => void permission.requestPermission()} />
        ) : (
          <>
            <Text>Activa el permiso de cámara en Ajustes.</Text>
            <Button label="Abrir Ajustes" onPress={() => void Linking.openSettings()} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      {pick && !pick.is05 && <Text variant="label">0.5x no disponible</Text>}
      <View style={styles.cameraBox}>
        {pick ? (
          <Camera
            style={StyleSheet.absoluteFill}
            device={pick.device}
            isActive={!systemOpen && !busy}
            outputs={[photoOutput]}
            zoom={pick.zoom}
            resizeMode="contain"
            onError={() => setError('La cámara dio un error. Usa la cámara del teléfono.')}
          />
        ) : (
          <Text style={styles.onBlack}>Buscando cámara…</Text>
        )}
      </View>
      <View style={styles.shutterBar}>
        <Shutter onPress={() => void take()} disabled={!pick || taking || busy} />
      </View>
      {pick && !pick.is05 && (
        <Text>Si tu teléfono tiene 0.5x o 0.6x, usa la cámara del teléfono y elígelo allí.</Text>
      )}
      <Button label="Usar cámara del teléfono" kind="secondary" onPress={() => void systemCamera()} disabled={busy} />
      {error && <Text variant="label">{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space(2) },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.text, justifyContent: 'center' },
  onBlack: { color: colors.background, padding: space(2) },
  shutterBar: { backgroundColor: colors.text, paddingVertical: space(2), alignItems: 'center' },
});
