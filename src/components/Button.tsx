import { Pressable, StyleSheet } from 'react-native';
import { colors, fonts, rule, space, type } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  label: string;
  onPress: () => void;
  /** primary = Swiss red (primary actions only). secondary = black outline. */
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onPress, kind = 'primary', disabled }: Props) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={[styles.label, { color: primary ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: space(6),
    paddingHorizontal: space(2),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  primary: { backgroundColor: colors.accent },
  // The border eats into the padding so the label stays flush with primary buttons.
  secondary: {
    borderWidth: rule.width,
    borderColor: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: space(2) - rule.width,
  },
  dim: { opacity: 0.5 },
  label: { ...type.body, fontFamily: fonts.bold },
});
