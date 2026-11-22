import * as Haptics from 'expo-haptics';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { usePressScale } from './usePressScale';

/** Square Swiss-red shutter button with a white frame; shrinks while pressed and ticks the phone. */
export function Shutter({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(0.88);
  return (
    <Animated.View style={[press.style, disabled && { opacity: 0.4 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Disparar"
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          onPress();
        }}
        style={styles.outer}
      >
        <Animated.View style={styles.inner} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: space(10),
    height: space(10),
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { width: space(7), height: space(7), backgroundColor: colors.accent },
});
