/**
 * Swiss / International Typographic Style tokens.
 * White ground, black type, one accent (Swiss red) for primary actions and
 * the shutter only. Strict 8 px grid. No radii, shadows or gradients.
 */
export const colors = {
  background: '#FFFFFF',
  text: '#000000',
  accent: '#DA291C',
  onAccent: '#FFFFFF',
} as const;

/** 8 px grid: space(1) = 8, space(2) = 16 ... */
export const GRID = 8;
export const space = (n: number): number => n * GRID;

export const fonts = {
  regular: 'Inter_400Regular',
  bold: 'Inter_700Bold',
} as const;

/** Type scale. Every size and line height sits on the 8 px grid. */
export const type = {
  small: { fontSize: 16, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 32, lineHeight: 40 },
  display: { fontSize: 48, lineHeight: 56 },
  answer: { fontSize: 40, lineHeight: 48 },
} as const;

/** Hairline rules are 2 px, black. */
export const rule = { width: 2, color: colors.text } as const;
