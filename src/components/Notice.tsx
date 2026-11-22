import { FadeIn } from './FadeIn';
import { Text } from './Text';

/** An error or status message, announced to screen readers. Fades in; renders nothing when empty. */
export function Notice({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <FadeIn key={text} offset={8}>
      <Text variant="label" accessibilityRole="alert" accessibilityLiveRegion="polite">
        {text}
      </Text>
    </FadeIn>
  );
}
