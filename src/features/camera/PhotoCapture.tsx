/**
 * Android camera for a space, full screen: opens the ultra-wide (0.5x) when the
 * phone exposes it, otherwise the widest lens with "0.5x no disponible". The
 * phone's own camera app is offered too, for phones (e.g. Xiaomi) that hide the
 * ultra-wide.
 */
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Camera, useCameraDevices, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { pickNativeLens } from '@/lib/lens/nativeLens';
import { forgetCameraSpace, rememberCameraSpace } from './pendingPhoto';
import { colors, space } from '@/theme/tokens';
import { CameraChrome, type CameraChromeHandle } from './CameraChrome';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

interface Props {
  onPhoto: (p: CapturedPhoto) => void;
  onBack: () => void;
  /** The space the photo is for (kept while the phone's camera app is open). */
  spaceId: string;
  busy?: boolean;
  /** Shown above the shutter, e.g. "Preparando la foto…" or an error. */
  notice?: string | null;
}

const fileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

export function PhotoCapture({ onPhoto, onBack, spaceId, busy, notice }: Props) {
  const permission = useCameraPermission();
  const devices = useCameraDevices();
  const pick = useMemo(() => pickNativeLens(devices), [devices]);
  const photoOutput = usePhotoOutput({ qualityPrioritization: 'quality' });
  const chrome = useRef<CameraChromeHandle>(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async () => {
    setTaking(true);
    setError(null);
    chrome.current?.flash();
    try {
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      onPhoto({
        uri: fileUri(file.filePath),
        width: file.width,
        height: file.height,
      });
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
      // If Android closes the app meanwhile, RecoverPendingPhoto sends the photo on return.
      await rememberCameraSpace(spaceId);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      await forgetCameraSpace();
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

  const lens = pick ? (pick.is05 ? '0.5x' : '0.5x no disponible') : null;
  const hint =
    pick && !pick.is05 ? 'Si tu teléfono tiene 0.5x o 0.6x, usa la cámara del teléfono y elígelo allí.' : null;

  if (!permission.hasPermission) {
    return (
      <CameraChrome
        onBack={onBack}
        onShutter={null}
        onSystemCamera={() => void systemCamera()}
        message={error}
        preview={
          <View style={styles.center}>
            <Text style={styles.onBlack}>Para tomar fotos, la app necesita la cámara.</Text>
            {permission.canRequestPermission ? (
              <Button label="Permitir cámara" onPress={() => void permission.requestPermission()} />
            ) : (
              <>
                <Text style={styles.onBlack}>Activa el permiso de cámara en Ajustes.</Text>
                <Button label="Abrir Ajustes" onPress={() => void Linking.openSettings()} />
              </>
            )}
          </View>
        }
      />
    );
  }

  return (
    <CameraChrome
      ref={chrome}
      onBack={onBack}
      lens={lens}
      busy={busy}
      message={notice ?? error ?? hint}
      onShutter={pick ? () => void take() : null}
      shutterDisabled={taking}
      onSystemCamera={() => void systemCamera()}
      preview={
        pick ? (
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
          <Text style={[styles.onBlack, styles.pad]}>Buscando cámara…</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { padding: space(2), gap: space(2) },
  onBlack: { color: colors.white },
  pad: { padding: space(2) },
});
