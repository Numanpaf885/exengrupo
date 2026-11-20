import { StyleSheet, View } from 'react-native';
import { rule, space } from '@/theme/tokens';
import { Text } from './Text';

/** A flush-left label / value pair separated by a top rule. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="label">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: rule.width, borderTopColor: rule.color, paddingTop: space(1), paddingBottom: space(2) },
});
