import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { FadeIn } from './FadeIn';
import { Text } from './Text';

/** An error (default) or success message in a soft banner, announced to screen readers. */
export function Notice({ text, tone = 'error' }: { text: string | null | undefined; tone?: 'error' | 'success' }) {
  if (!text) return null;
  const ok = tone === 'success';
  return (
    <FadeIn key={text} offset={8}>
      <View style={[styles.box, { backgroundColor: ok ? colors.successSoft : colors.accentSoft }]}>
        <Text variant="label" tone={ok ? 'success' : 'accent'} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {text}
        </Text>
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, paddingHorizontal: space(2), paddingVertical: space(1.5) },
});
