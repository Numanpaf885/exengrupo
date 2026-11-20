import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';
import { Text } from './Text';

/** Full-height white page with a 16 px side gutter, flush-left content. */
export function Screen({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(4) },
      ]}
    >
      {onBack && (
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
          <Text variant="label">Volver</Text>
        </Pressable>
      )}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  back: { minHeight: space(6), justifyContent: 'center', alignSelf: 'flex-start' },
  content: { paddingHorizontal: space(2), gap: space(3), alignItems: 'stretch' },
});
