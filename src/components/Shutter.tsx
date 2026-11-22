import * as Haptics from 'expo-haptics';
import { Animated, Platform, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { usePressScale } from './usePressScale';

/** Round camera shutter (white ring, white disc); shrinks while pressed and ticks the phone. */
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
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.white },
});
