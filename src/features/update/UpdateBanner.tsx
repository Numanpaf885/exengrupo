import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { LoadingBar } from '@/components/LoadingBar';
import { Card } from '@/components/Section';
import { Text } from '@/components/Text';
import { space } from '@/theme/tokens';
import { installApk } from './installApk';
import { dismissUpdate, useAppUpdate } from './useAppUpdate';

/**
 * "Nueva versión disponible" card (Android app only). "Actualizar" downloads the
 * new APK inside the app and opens Android's installer: one more tap on
 * Android's own "Actualizar" and it installs over this app (spaces and session
 * are kept). "Más tarde" hides it until the app is opened again.
 */
export function UpdateBanner() {
  const update = useAppUpdate();
  const [pct, setPct] = useState<number | null>(null);
  if (!update) return null;

  const start = async () => {
    setPct(0);
    await installApk(update.url, update.build, setPct);
    setPct(null);
  };

  const downloading = pct !== null;
  return (
    <FadeIn>
      <Card>
        <Text variant="headline">Nueva versión disponible</Text>
        <Text tone="secondary">
          {downloading
            ? `Descargando… ${pct} %. Después toca «Actualizar» en la ventana de Android.`
            : 'Toca «Actualizar» y luego confirma en la ventana de Android. No pierdes nada.'}
        </Text>
        {downloading ? (
          <LoadingBar label="Descargando la actualización…" />
        ) : (
          <View style={styles.actions}>
            <Button label="Actualizar" onPress={() => void start()} flex />
            <Button label="Más tarde" kind="secondary" onPress={() => dismissUpdate(update.build)} flex />
          </View>
        )}
      </Card>
    </FadeIn>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: space(1) } });
