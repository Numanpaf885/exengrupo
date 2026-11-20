import { type Ref, useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Text } from './Text';

/** Swiss text field: bold label above, large type, black rule below (thicker on focus). */
export function TextField({ label, ...props }: TextInputProps & { label: string; ref?: Ref<TextInputInstance> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.text}
        selectionColor={colors.text}
        cursorColor={colors.text}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, { borderBottomWidth: focused ? 4 : 2 }, webNoOutline]}
      />
    </View>
  );
}

// The browser's own focus ring is rounded and blue; the thicker rule replaces it.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  wrap: { gap: space(1) },
  input: {
    ...type.title,
    fontFamily: fonts.regular,
    color: colors.text,
    height: space(6),
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderBottomColor: colors.text,
    borderRadius: 0,
  },
});
