/**
 * Design tokens (Apple-style redesign, user decision 2026-11-22; replaces the
 * original Swiss tokens). Grouped light-gray background with white rounded
 * cards, Inter (close to SF Pro) in four weights, one tint colour — the
 * exengrupo red — for actions, and an 8 px grid (4 px half-steps allowed).
 */
import { StyleSheet } from 'react-native';

export const colors = {
  /** Grouped background (iOS systemGroupedBackground). */
  background: '#F2F2F7',
  /** Cards, cells, inputs. */
  surface: '#FFFFFF',
  text: '#000000',
  /** Secondary labels: 5:1 on white, 4.6:1 on the grouped background. */
  secondary: '#6C6C70',
  separator: '#C6C6C8',
  /** Pressed cells, tracks, neutral badges. */
  fill: '#E9E9EE',
  /** Tint: primary actions, links, the active state. */
  accent: '#DA291C',
  accentSoft: 'rgba(218, 41, 28, 0.10)',
  onAccent: '#FFFFFF',
  success: '#1F7A35',
  successSoft: 'rgba(52, 199, 89, 0.16)',
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
