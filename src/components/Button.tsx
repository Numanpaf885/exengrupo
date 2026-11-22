import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, rule, space, type } from '@/theme/tokens';
import { Text } from './Text';
import { usePressScale } from './usePressScale';

interface Props {
  label: string;
  onPress: () => void;
  /**
   * primary = Swiss red (primary actions only). secondary = black outline.
   * selected = black (current tab). ghost = bold text only (header links).
   */
  kind?: 'primary' | 'secondary' | 'selected' | 'ghost';
  disabled?: boolean;
  /** Stretch to fill the row (used side by side in footers). */
  flex?: boolean;
  /** Shown at the right edge, e.g. "→". */
  trailing?: string;
}

export function Button({ label, onPress, kind = 'primary', disabled, flex, trailing }: Props) {
  const press = usePressScale();
  const filled = kind === 'primary' || kind === 'selected';
  const color = filled ? colors.onAccent : colors.text;
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
        hitSlop={kind === 'ghost' ? 8 : undefined}
        style={({ pressed }) => [styles.base, styles[kind], pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {trailing && <Text style={[styles.label, { color }]}>{trailing}</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  base: {
    minHeight: space(7),
    paddingHorizontal: space(2),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space(1),
  },
  primary: { backgroundColor: colors.accent },
  selected: { backgroundColor: colors.text },
  // The border eats into the padding so the label stays flush with primary buttons.
  secondary: {
    borderWidth: rule.width,
    borderColor: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: space(2) - rule.width,
  },
  ghost: { minHeight: space(6), paddingHorizontal: 0, justifyContent: 'flex-start' },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.4 },
  label: { ...type.body, fontFamily: fonts.bold, flexShrink: 1 },
});
