import { Children, createContext, type ReactNode, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { Text } from './Text';

/** -1 outside a Section; otherwise the row's position (0 = first, no separator above). */
export const RowIndex = createContext(-1);
export const useRowIndex = () => useContext(RowIndex);

/**
 * Inset grouped list: a white rounded card of rows separated by inset
 * hairlines, with an optional small header and footer note.
 */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.wrap}>
      {title ? (
        <Text variant="caption" tone="secondary" style={styles.title}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      {rows.length > 0 && (
        <View style={styles.card}>
          {rows.map((row, i) => (
            <RowIndex.Provider key={i} value={i}>
              {row}
            </RowIndex.Provider>
          ))}
        </View>
      )}
      {footer ? (
        <Text variant="caption" tone="secondary" style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** A standalone white rounded card. */
export function Card({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return <View style={[styles.card, padded && styles.padded]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { gap: space(1) },
  title: { paddingHorizontal: space(2), letterSpacing: 0.2 },
  footer: { paddingHorizontal: space(2) },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: space(2), gap: space(1.5) },
});
