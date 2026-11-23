import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts, radius, rule, space } from '@/theme/tokens';
import { hovered } from './Button';
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
  /** Makes the row a checkbox (iOS-style tick on the right instead of the chevron). */
  checked?: boolean;
}

/**
 * A list cell. Inside a Section it is one row of the card (inset hairline
 * above every row but the first); on its own it is a small card. Pressable
 * rows highlight on touch and show a chevron.
 */
export function ListRow({ children, onPress, onPressIn, label, leading, trailing, checked }: Props) {
  const checkbox = checked !== undefined;
  const index = useRowIndex();
  const standalone = index < 0;
  const body = (
    <>
      {index > 0 && <View style={[styles.separator, leading ? styles.separatorLeading : null]} />}
      {leading}
      <View style={styles.grow}>{children}</View>
      {trailing}
      {checkbox && (
        <View style={[styles.check, checked && styles.checkOn]} accessibilityElementsHidden importantForAccessibility="no">
          {checked && <Text style={styles.tick}>✓</Text>}
        </View>
      )}
      {onPress && !checkbox && (
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
      accessibilityRole={checkbox ? 'checkbox' : 'button'}
      accessibilityState={checkbox ? { checked } : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={onPressIn}
      style={(state) => [style, (state.pressed || hovered(state)) && styles.pressed]}
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
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.onAccent, fontSize: 14, lineHeight: 16, fontFamily: fonts.bold },
  chevron: { fontSize: 24, lineHeight: 24, color: colors.separator, marginTop: -2 },
});
