/**
 * Design tokens: Apple-style dark interface (user decisions 2026-11-22: the
 * Swiss style was replaced by an Apple-style design, then the app went dark).
 * Pure-black grouped background with dark-gray rounded cards, white text, Inter
 * in four weights, one tint colour — the exengrupo red — and an 8 px grid.
 * Text colours keep at least 4.5:1 contrast on both background and cards.
 */
import { StyleSheet } from 'react-native';

export const colors = {
  /** Grouped background (iOS dark systemGroupedBackground). */
  background: '#000000',
  /** Cards, cells, inputs (iOS dark secondarySystemGroupedBackground). */
  surface: '#1C1C1E',
  text: '#FFFFFF',
  /** Secondary labels: 7:1 on black, 6:1 on the cards. */
  secondary: '#A1A1A8',
  separator: '#38383A',
  /** Pressed cells, tracks, neutral badges. */
  fill: '#2C2C2E',
  /** Brand red for filled buttons (white text on it: 5:1). */
  accent: '#DA291C',
  /** Red for text and links on dark backgrounds (5.4:1 on the cards). */
  accentText: '#FF6259',
  accentSoft: 'rgba(255, 98, 89, 0.16)',
  onAccent: '#FFFFFF',
  success: '#32D74B',
  successSoft: 'rgba(50, 215, 75, 0.16)',
  /** Frosted bottom bar. */
  bar: 'rgba(22, 22, 24, 0.92)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** 8 px grid: space(1) = 8, space(2) = 16, space(0.5) = 4. */
export const GRID = 8;
export const space = (n: number): number => n * GRID;

export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale after iOS Dynamic Type (Large): body 17, subhead 15, footnote 13. */
export const type = {
  caption: { fontSize: 13, lineHeight: 18 },
  small: { fontSize: 15, lineHeight: 20 },
  body: { fontSize: 17, lineHeight: 22 },
  title: { fontSize: 22, lineHeight: 28 },
  display: { fontSize: 34, lineHeight: 41 },
  /** Answers: large, but a 10-question line still fits a 360 px screen. */
  answer: { fontSize: 28, lineHeight: 34 },
} as const;

/** Hairline separators. */
export const rule = { width: StyleSheet.hairlineWidth, color: colors.separator } as const;
