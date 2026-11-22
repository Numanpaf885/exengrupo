import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '@/lib/connectivity';
import { colors, rule, space } from '@/theme/tokens';
import { Button } from './Button';
import { FadeIn } from './FadeIn';
import { Text } from './Text';

interface Props {
  children: ReactNode;
  onBack?: () => void;
  /** Bold text links at the top right (e.g. "Miembros"). */
  headerRight?: ReactNode;
  /** Pinned to the bottom, above the home indicator: the screen's main action stays in reach. */
  footer?: ReactNode;
  /** Pull to refresh (Android). */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Full-height white page with a 16 px side gutter, flush-left content, the
 * offline bar and an optional pinned footer. Content fades in on mount.
 */
export function Screen({ children, onBack, headerRight, footer, onRefresh, refreshing }: Props) {
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  const hasHeader = !!onBack || !!headerRight;
  return (
    <View style={styles.root}>
      {offline && (
        <FadeIn offset={-8}>
          <View style={[styles.offline, { paddingTop: insets.top + space(1) }]} accessibilityRole="alert">
            <Text variant="label" style={styles.offlineText}>
              Sin conexión. Revisa tu internet.
            </Text>
          </View>
        </FadeIn>
      )}
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.text]} tintColor={colors.text} />
          ) : undefined
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (offline ? 0 : insets.top) + (hasHeader ? space(1) : space(3)),
            paddingBottom: (footer ? space(3) : insets.bottom + space(4)),
          },
        ]}
      >
        {hasHeader && (
          <View style={styles.header}>
            {onBack ? <Button kind="ghost" label="← Volver" onPress={onBack} /> : <View />}
            {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
          </View>
        )}
        <FadeIn style={styles.body}>{children}</FadeIn>
      </ScrollView>
      {footer && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space(2) }]}>{footer}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  offline: { backgroundColor: colors.text, paddingHorizontal: space(2), paddingBottom: space(1) },
  offlineText: { color: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: space(6) },
  headerRight: { flexDirection: 'row', gap: space(3) },
  content: { paddingHorizontal: space(2), gap: space(2), alignItems: 'stretch', flexGrow: 1 },
  body: { gap: space(3) },
  footer: {
    paddingHorizontal: space(2),
    paddingTop: space(2),
    backgroundColor: colors.background,
    borderTopWidth: rule.width,
    borderTopColor: rule.color,
    flexDirection: 'row',
    gap: space(1),
  },
});
