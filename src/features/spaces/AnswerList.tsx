import { Platform, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { displayAnswer } from '@/lib/answerDisplay';
import { parseAnswerLine } from '@/lib/answerLines';
import { space as grid } from '@/theme/tokens';

// Browsers collapse the double spaces between answers unless told not to.
const keepSpaces = Platform.OS === 'web' ? ({ whiteSpace: 'pre-wrap' } as object) : undefined;

/**
 * One answer per line ("1. a", "2. b", "3. b/c ?", "4. El corazón."), each with
 * the AI that gave it on the right. Anything that isn't an answer line is shown as is.
 */
export function AnswerList({ answer, labels }: { answer: string; labels: Record<string, string> }) {
  const items = parseAnswerLine(answer);
  if (!items) {
    return (
      <Text variant="answer" selectable style={keepSpaces}>
        {displayAnswer(answer)}
      </Text>
    );
  }
  return (
    <View style={styles.answers}>
      {items.map((item) => (
        <View key={item.n} style={styles.answerRow}>
          <Text variant="title" tone="secondary" style={styles.answerNumber}>
            {`${item.n}.`}
          </Text>
          <Text variant="title" tone={item.unsure ? 'accent' : 'primary'} selectable style={styles.answerText}>
            {displayAnswer(item.unsure ? `${item.text} ?` : item.text)}
          </Text>
          {labels[item.n] ? (
            <Text variant="caption" tone="secondary" style={styles.answerSource}>
              {labels[item.n]}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  answers: { gap: grid(1) },
  answerRow: { flexDirection: 'row', alignItems: 'baseline', gap: grid(1) },
  answerNumber: { minWidth: 36 },
  answerText: { flex: 1 },
  answerSource: { maxWidth: '45%', textAlign: 'right' },
});
