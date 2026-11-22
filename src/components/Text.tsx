import { Text as RNText, type TextProps, StyleSheet } from 'react-native';
import { colors, fonts, type } from '@/theme/tokens';

type Variant = 'body' | 'label' | 'title' | 'display' | 'answer' | 'caption' | 'headline';
type Tone = 'primary' | 'secondary' | 'accent' | 'success' | 'onAccent';

/**
 * display = large title (34 bold) · title = 22 bold · headline = 17 semibold ·
 * body = 17 · label = 15 semibold · caption = 13 · answer = 28 bold.
 */
export function Text({ variant = 'body', tone = 'primary', style, ...props }: TextProps & { variant?: Variant; tone?: Tone }) {
  return <RNText {...props} style={[styles.base, styles[variant], tones[tone], style]} />;
}

const tones = StyleSheet.create({
  primary: { color: colors.text },
  secondary: { color: colors.secondary },
  accent: { color: colors.accent },
  success: { color: colors.success },
  onAccent: { color: colors.onAccent },
});

const styles = StyleSheet.create({
  base: { textAlign: 'left', fontFamily: fonts.regular },
  body: { ...type.body, letterSpacing: -0.2 },
  headline: { ...type.body, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  label: { ...type.small, fontFamily: fonts.semibold, letterSpacing: -0.1 },
  caption: { ...type.caption },
  title: { ...type.title, fontFamily: fonts.bold, letterSpacing: -0.4 },
  display: { ...type.display, fontFamily: fonts.bold, letterSpacing: -0.8 },
  answer: { ...type.answer, fontFamily: fonts.bold, letterSpacing: -0.5 },
});
