import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, space, type } from '@/theme/tokens';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

interface Props {
  label: string;
  onPress: () => void;
  /**
   * primary = filled red (the main action) · secondary = tinted (light red) ·
   * selected = filled black (current tab) · ghost = red text link (bars, rows).
   * destructive = red text on a white card.
   */
  kind?: 'primary' | 'secondary' | 'selected' | 'ghost' | 'destructive';
  disabled?: boolean;
  /** Stretch to fill the row (used side by side in footers). */
  flex?: boolean;
  /** Small trailing glyph for text links, e.g. "›". Ignored on filled buttons. */
  trailing?: string;
  /** Compact capsule (e.g. "Invitar" next to the code). */
  small?: boolean;
}

export function Button({ label, onPress, kind = 'primary', disabled, flex, trailing, small }: Props) {
  const press = usePressScale(kind === 'ghost' ? 1 : 0.97);
  const color = kind === 'primary' || kind === 'selected' ? colors.onAccent : colors.accent;
  const ghost = kind === 'ghost';
  return (
    <Animated.View style={[press.style, flex && styles.flex, disabled && styles.dim]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: kind === 'selected', disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={ghost || small ? 8 : undefined}
        style={({ pressed }) => [
          styles.base,
          styles[kind],
          small && styles.small,
          pressed && (ghost ? styles.ghostPressed : styles.pressed),
        ]}
      >
        <Text style={[ghost ? styles.ghostLabel : small ? styles.smallLabel : styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {ghost && trailing ? <Text style={[styles.ghostLabel, styles.trailing, { color: colors.secondary }]}>{trailing}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  base: {
    minHeight: 50,
    paddingHorizontal: space(2.5),
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space(1),
  },
  primary: { backgroundColor: colors.accent },
  selected: { backgroundColor: colors.black },
  secondary: { backgroundColor: colors.accentSoft },
  destructive: { backgroundColor: colors.surface },
  ghost: { minHeight: 44, paddingHorizontal: 0, borderRadius: 0, justifyContent: 'flex-start', gap: space(0.5) },
  small: { minHeight: 32, paddingHorizontal: space(1.5), borderRadius: radius.pill },
  pressed: { opacity: 0.8 },
  ghostPressed: { opacity: 0.4 },
  dim: { opacity: 0.4 },
  label: { ...type.body, fontFamily: fonts.semibold, letterSpacing: -0.2, flexShrink: 1 },
  smallLabel: { ...type.small, fontFamily: fonts.semibold },
  ghostLabel: { ...type.body, fontFamily: fonts.medium, letterSpacing: -0.2 },
  trailing: { fontSize: 22, lineHeight: 22 },
});
