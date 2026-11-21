import { Text } from './Text';

/** An error or status message, announced to screen readers. Renders nothing when empty. */
export function Notice({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <Text variant="label" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}
