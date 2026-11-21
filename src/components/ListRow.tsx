import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { rule, space } from '@/theme/tokens';

/** A full-width row with a black top rule. Pressable when onPress is given. */
export function ListRow({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label?: string }) {
  if (!onPress) return <View style={styles.row}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: rule.width, borderTopColor: rule.color, paddingTop: space(1), paddingBottom: space(2), gap: space(1) },
});
