import { Text as RNText, type TextProps, StyleSheet } from 'react-native';
import { colors, fonts, type } from '@/theme/tokens';

type Variant = 'body' | 'label' | 'title' | 'display';

export function Text({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  return <RNText {...props} style={[styles.base, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text, textAlign: 'left', fontFamily: fonts.regular },
  body: { ...type.body },
  label: { ...type.small, fontFamily: fonts.bold },
  title: { ...type.title, fontFamily: fonts.bold, letterSpacing: -0.5 },
  display: { ...type.display, fontFamily: fonts.bold, letterSpacing: -1 },
});
