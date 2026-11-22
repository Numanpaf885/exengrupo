import { StyleSheet, View } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';
import { Text } from './Text';

/** 40 px leading badge: rounded square (spaces, files) or circle (people). */
export function Badge({ text, round, tone = 'accent' }: { text: string; round?: boolean; tone?: 'accent' | 'neutral' }) {
  return (
    <View
      style={[styles.box, round && styles.round, { backgroundColor: tone === 'accent' ? colors.accentSoft : colors.fill }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Text style={[styles.text, { color: tone === 'accent' ? colors.accent : colors.secondary }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Up to two initials: "Física 2º Bach" → "F2", "numan" → "N". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (w: string) => [...w][0]?.toUpperCase() ?? '';
  return words.length > 1 ? first(words[0]) + first(words[1]) : first(words[0] ?? '?');
}

/** Small capsule status label. */
export function Chip({ label, tone }: { label: string; tone: 'neutral' | 'success' | 'danger' }) {
  const bg = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.accentSoft : colors.fill;
  const fg = tone === 'success' ? colors.success : tone === 'danger' ? colors.accent : colors.secondary;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 20 },
  text: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.2 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
});
