import * as Haptics from 'expo-haptics';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

/** A short vibration tick when a photo is taken (Android app only). */
export function shutterTick(): void {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Long, full-width white capsule "Tomar foto": easy to hit with a thumb. Shrinks while pressed. */
export function Shutter({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(0.96);
  return (
    <Animated.View style={[styles.wrap, press.style, disabled && { opacity: 0.4 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tomar foto"
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          shutterTick();
          onPress();
        }}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.label}>Tomar foto</Text>
      </Pressable>
    </Animated.View>
  );
}

export const SHUTTER_HEIGHT = 72;

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  button: {
    height: SHUTTER_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.black, fontFamily: fonts.bold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
});
