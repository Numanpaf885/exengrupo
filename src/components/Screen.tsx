import type { ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '@/lib/connectivity';
import { DESKTOP_COLUMN, DESKTOP_NARROW, useDesktop } from '@/lib/useDesktop';
import { colors, fonts, rule, space, type } from '@/theme/tokens';
import { FadeIn } from './FadeIn';
import { Text } from './Text';

interface Props {
  children: ReactNode;
  onBack?: () => void;
  /** Text links at the top right (e.g. "Miembros"). */
  headerRight?: ReactNode;
  /** Pinned to the bottom on a frosted bar: the screen's main action stays in reach. */
  footer?: ReactNode;
  /** Pull to refresh (Android). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Forms (sign-in, create, join): a narrow, vertically centred column on desktop. */
  narrow?: boolean;
}

// iOS-style frosted material for the bottom bar where the browser supports it.
const frosted =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)' } as object)
    : null;

/**
 * Grouped light-gray page with a 16 px gutter, a small nav row (‹ Atrás + links),
 * the offline banner and an optional frosted footer. Content fades in on mount.
 */
export function Screen(props: Props) {
  const desktop = useDesktop();
  return desktop ? <DesktopScreen {...props} /> : <MobileScreen {...props} />;
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Atrás"
      onPress={onBack}
      hitSlop={12}
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.4 }]}
    >
      <Text style={styles.backChevron}>‹</Text>
      <Text style={styles.backLabel}>Atrás</Text>
    </Pressable>
  );
}

function OfflineBanner() {
  return (
    <FadeIn offset={-8}>
      <View style={styles.offline} accessibilityRole="alert">
        <Text variant="label" style={styles.offlineText}>
          Sin conexión. Revisa tu internet.
        </Text>
      </View>
    </FadeIn>
  );
}

/**
 * Desktop browsers: a centred column (760 px, or 440 px for forms) with a
 * toolbar on top — ‹ Atrás on the left, the links and the screen's main
 * actions (the mobile footer) as compact buttons on the right.
 */
function DesktopScreen({ children, onBack, headerRight, footer, narrow }: Props) {
  const offline = useOffline();
  const toolbar = !!onBack || !!headerRight || !!footer;
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.deskContent, narrow && styles.deskCentered]}
      >
        <View style={[styles.deskColumn, { maxWidth: narrow ? DESKTOP_NARROW : DESKTOP_COLUMN }]}>
          {toolbar && (
            <View style={styles.deskToolbar}>
              {onBack ? <BackLink onBack={onBack} /> : <View />}
              <View style={styles.deskToolbarRight}>
                {headerRight}
                {footer && <View style={styles.deskActions}>{footer}</View>}
              </View>
            </View>
          )}
          {offline && <OfflineBanner />}
          <FadeIn style={styles.deskBody}>{children}</FadeIn>
        </View>
      </ScrollView>
    </View>
  );
}

/** Phones (Android app and the iPhone web app): unchanged mobile layout. */
function MobileScreen({ children, onBack, headerRight, footer, onRefresh, refreshing }: Props) {
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  const hasHeader = !!onBack || !!headerRight;
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.root}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[colors.accent]} progressBackgroundColor={colors.surface} tintColor={colors.secondary} />
          ) : undefined
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (hasHeader ? space(0.5) : space(3)),
            paddingBottom: footer ? space(16) + insets.bottom : insets.bottom + space(4),
          },
        ]}
      >
        {hasHeader && (
          <View style={styles.header}>
            {onBack ? <BackLink onBack={onBack} /> : <View />}
            {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
          </View>
        )}
        {offline && <OfflineBanner />}
        <FadeIn style={styles.body}>{children}</FadeIn>
      </ScrollView>
      {footer && (
        <View style={[styles.footer, frosted, { paddingBottom: insets.bottom + space(1.5) }]}>{footer}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  offline: { backgroundColor: colors.fill, borderRadius: 12, paddingHorizontal: space(2), paddingVertical: space(1.5) },
  offlineText: { color: colors.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
  backChevron: { fontSize: 34, lineHeight: 34, color: colors.accentText, marginTop: -4, fontFamily: fonts.regular },
  backLabel: { ...type.body, color: colors.accentText, fontFamily: fonts.medium },
  headerRight: { flexDirection: 'row', gap: space(2.5) },
  content: { paddingHorizontal: space(2), gap: space(2), alignItems: 'stretch', flexGrow: 1 },
  body: { gap: space(3) },
  deskContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space(4), paddingTop: space(5), paddingBottom: space(8) },
  deskCentered: { justifyContent: 'center' },
  deskColumn: { width: '100%', gap: space(3) },
  deskToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, gap: space(2) },
  deskToolbarRight: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  deskActions: { flexDirection: 'row', gap: space(1) },
  deskBody: { gap: space(3) },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space(2),
    paddingTop: space(1.5),
    backgroundColor: colors.bar,
    borderTopWidth: rule.width,
    borderTopColor: rule.color,
    flexDirection: 'row',
    gap: space(1.5),
  },
});
