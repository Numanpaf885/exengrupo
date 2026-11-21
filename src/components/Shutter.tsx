import { Pressable, StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme/tokens';

/** Square Swiss-red shutter button. */
export function Shutter({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Disparar"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.outer, (pressed || disabled) && { opacity: 0.5 }]}
    >
      <View style={styles.inner} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: space(9),
    height: space(9),
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { width: space(5), height: space(5), backgroundColor: colors.accent },
});
