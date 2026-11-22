import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { Card } from '@/components/Section';
import { Text } from '@/components/Text';
import { space } from '@/theme/tokens';
import { dismissUpdate, useAppUpdate } from './useAppUpdate';

/**
 * "Nueva versión disponible" card (Android app only). "Actualizar" downloads the
 * new APK; Android then asks to install it over the current app (your spaces and
 * session are kept). Renders nothing when the app is up to date.
 */
export function UpdateBanner() {
  const update = useAppUpdate();
  const [started, setStarted] = useState(false);
  if (!update) return null;

  const download = () => {
    setStarted(true);
    void Linking.openURL(update.url).catch(() => setStarted(false));
  };

  return (
    <FadeIn>
      <Card>
        <Text variant="headline">Nueva versión disponible</Text>
        <Text tone="secondary">
          {started
            ? 'Se está descargando. Cuando termine, toca la notificación de descarga y luego «Actualizar». No pierdes nada.'
            : `Hay una versión nueva de exengrupo (build ${update.build}). Se instala encima de esta.`}
        </Text>
        <View style={styles.actions}>
          <Button label={started ? 'Descargar de nuevo' : 'Actualizar'} onPress={download} flex />
          <Button label="Más tarde" kind="secondary" onPress={() => dismissUpdate(update.build)} flex />
        </View>
      </Card>
    </FadeIn>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: space(1) } });
