import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '@/lib/connectivity';
import { colors, space } from '@/theme/tokens';
import { Text } from './Text';

/** Full-height white page with a 16 px side gutter, flush-left content, and the offline bar. */
export function Screen({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  return (
    <View style={styles.root}>
      {offline && (
        <View style={[styles.offline, { paddingTop: insets.top + space(1) }]} accessibilityRole="alert">
          <Text variant="label" style={styles.offlineText}>
            Sin conexión. Revisa tu internet.
          </Text>
        </View>
      )}
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: (offline ? 0 : insets.top) + space(3), paddingBottom: insets.bottom + space(4) },
        ]}
      >
        {onBack && (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text variant="label">Volver</Text>
          </Pressable>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  offline: { backgroundColor: colors.text, paddingHorizontal: space(2), paddingBottom: space(1) },
  offlineText: { color: colors.background },
  back: { minHeight: space(6), justifyContent: 'center', alignSelf: 'flex-start' },
  content: { paddingHorizontal: space(2), gap: space(3), alignItems: 'stretch' },
});
