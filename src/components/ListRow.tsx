import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { rule, space } from '@/theme/tokens';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** Fires on touch-down: used to start loading the next screen early. */
  onPressIn?: () => void;
  label?: string;
}

/** A full-width row with a black top rule. Pressable (with a "→") when onPress is given. */
export function ListRow({ children, onPress, onPressIn, label }: Props) {
  const press = usePressScale(0.985);
  if (!onPress) return <View style={styles.row}>{children}</View>;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => {
          press.onPressIn();
          onPressIn?.();
        }}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [styles.row, styles.pressable, pressed && { opacity: 0.6 }]}
      >
        <View style={styles.grow}>{children}</View>
        <Text variant="title" accessibilityElementsHidden importantForAccessibility="no">
          →
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: rule.width, borderTopColor: rule.color, paddingTop: space(1), paddingBottom: space(2), gap: space(1) },
  pressable: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: space(10) },
  grow: { flex: 1 },
});
