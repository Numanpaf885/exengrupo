import { ListRow } from './ListRow';
import { Text } from './Text';

/** A label / value pair as a list cell. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <ListRow>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text>{value}</Text>
    </ListRow>
  );
}
