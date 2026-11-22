/**
 * Full-screen black camera layout shared by the Android and web cameras.
 * Everything fits on one screen (no scrolling): a top bar (back + lens status),
 * the preview filling the middle, and a bottom bar with the shutter in the
 * thumb zone and "Cámara del teléfono" beside it.
 */
import { StatusBar } from 'expo-status-bar';
import { forwardRef, type ReactNode, useImperativeHandle, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn } from '@/components/FadeIn';
import { SHUTTER_HEIGHT, Shutter, shutterTick } from '@/components/Shutter';
import { Text } from '@/components/Text';
import { colors, radius, space } from '@/theme/tokens';
import { nativeDriver, reducedMotion } from '@/theme/motion';

export interface CameraChromeHandle {
  /** White flash over the preview: instant feedback that the photo was taken. */
  flash(): void;
}

interface Props {
  onBack: () => void;
  /** Lens line in the top bar, e.g. "0.5x" or "0.5x no disponible". */
  lens?: string | null;
  preview: ReactNode;
  /** null hides the shutter (no camera yet). */
  onShutter: (() => void) | null;
  shutterDisabled?: boolean;
  onSystemCamera?: () => void;
  busy?: boolean;
  message?: string | null;
}

/** Translucent capsule button on the black camera chrome (like the iOS camera). */
function Pill({ label, onPress, disabled, chevron }: { label: string; onPress: () => void; disabled?: boolean; chevron?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chevron ? 'Atrás' : label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, (pressed || disabled) && { opacity: 0.5 }]}
    >
      {chevron && <Text style={styles.pillChevron}>‹</Text>}
      <Text variant="label" style={styles.onBlack}>
        {label}
      </Text>
    </Pressable>
  );
}

export const CameraChrome = forwardRef<CameraChromeHandle, Props>(function CameraChrome(
  { onBack, lens, preview, onShutter, shutterDisabled, onSystemCamera, busy, message },
  ref,
) {
  const insets = useSafeAreaInsets();
  const flash = useRef(new Animated.Value(0)).current;
  const shoot = () => {
    if (!onShutter) return;
    shutterTick();
    onShutter();
  };
  useImperativeHandle(ref, () => ({
    flash() {
      if (reducedMotion()) return;
      flash.setValue(0.9);
      Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: nativeDriver }).start();
    },
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + space(1) }]}>
        <Pill label="Atrás" chevron onPress={onBack} />
        {lens ? (
          <View style={[styles.lens, lens === '0.5x' && styles.lensOn]}>
            <Text variant="label" style={lens === '0.5x' ? styles.lensOnText : styles.onBlack}>
              {lens}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.preview}>
        {preview}
        {/* Tapping anywhere on the picture also takes the photo. */}
        {onShutter && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tomar foto tocando la imagen"
            disabled={shutterDisabled || busy}
            onPress={shoot}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space(2) }]}>
        {message ? (
          <FadeIn offset={8}>
            <Text variant="caption" style={styles.message} accessibilityRole="alert">
              {message}
            </Text>
          </FadeIn>
        ) : onShutter ? (
          <Text variant="caption" style={styles.message}>
            Toca la imagen o el botón para tomar la foto.
          </Text>
        ) : null}
        {onSystemCamera && (
          <View style={styles.center}>
            <Pill label="Usar cámara del teléfono" onPress={onSystemCamera} disabled={busy} />
          </View>
        )}
        {onShutter ? <Shutter onPress={onShutter} disabled={shutterDisabled || busy} /> : <View style={styles.shutterSpace} />}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  top: {
    paddingHorizontal: space(2),
    paddingBottom: space(1),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  flash: { backgroundColor: colors.white },
  bottom: { paddingHorizontal: space(2), paddingTop: space(2), gap: space(2) },
  center: { alignItems: 'center' },
  shutterSpace: { height: SHUTTER_HEIGHT },
  pill: {
    minHeight: 36,
    paddingHorizontal: space(1.5),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  pillChevron: { fontSize: 26, lineHeight: 26, color: colors.white, marginTop: -3 },
  lens: { paddingHorizontal: space(1.5), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
  lensOn: { backgroundColor: 'rgba(255,214,10,0.18)' },
  lensOnText: { color: '#FFD60A' },
  message: { color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  onBlack: { color: colors.white },
});
