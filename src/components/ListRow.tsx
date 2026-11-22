import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, rule, space } from '@/theme/tokens';
import { useRowIndex } from './Section';
import { Text } from './Text';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** Fires on touch-down: used to start loading the next screen early. */
  onPressIn?: () => void;
  label?: string;
  /** Left accessory (badge, avatar). */
  leading?: ReactNode;
  /** Right accessory (chip, link). */
  trailing?: ReactNode;
}

/**
 * A list cell. Inside a Section it is one row of the card (inset hairline
 * above every row but the first); on its own it is a small card. Pressable
 * rows highlight on touch and show a chevron.
 */
export function ListRow({ children, onPress, onPressIn, label, leading, trailing }: Props) {
  const index = useRowIndex();
  const standalone = index < 0;
  const body = (
    <>
      {index > 0 && <View style={[styles.separator, leading ? styles.separatorLeading : null]} />}
      {leading}
      <View style={styles.grow}>{children}</View>
      {trailing}
      {onPress && (
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      )}
    </>
  );
  const style = [styles.row, standalone && styles.standalone];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
  },
  standalone: { borderRadius: radius.lg },
  pressed: { backgroundColor: colors.fill },
  grow: { flex: 1, gap: 2 },
  separator: {
    position: 'absolute',
    top: 0,
    left: space(2),
    right: 0,
    height: rule.width,
    backgroundColor: rule.color,
  },
  separatorLeading: { left: space(2) + 40 + space(1.5) },
  chevron: { fontSize: 24, lineHeight: 24, color: colors.separator, marginTop: -2 },
});
