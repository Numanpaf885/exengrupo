import { type Ref, useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';
import { colors, fonts, radius, space, type } from '@/theme/tokens';
import { Text } from './Text';

/** Rounded white input with a small label above; the border turns red while focused. */
export function TextField({ label, ...props }: TextInputProps & { label: string; ref?: Ref<TextInputInstance> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="secondary" style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.secondary}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, { borderColor: focused ? colors.accent : 'transparent' }, webNoOutline]}
      />
    </View>
  );
}

// The browser's own focus ring is replaced by the red border.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  wrap: { gap: space(0.75) },
  label: { paddingHorizontal: space(2) },
  input: {
    ...type.body,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.surface,
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: space(2),
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
});
