import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useDesktop } from '@/lib/useDesktop';
import { colors, radius } from '@/theme/tokens';
import { hovered } from './Button';
import { usePressScale } from './usePressScale';

/**
 * Round tinted icon button that sits next to a main action and matches its
 * height (64 on phones, 40 in the desktop toolbar). The icon is drawn with
 * views (no emoji, no icon font): an upload arrow over a tray.
 */
export function RoundUploadButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(0.94);
  const size = useDesktop() ? 40 : 64;
  const k = size / 64; // icon scale
  return (
    <Animated.View style={[press.style, disabled && styles.dim]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={(state) => [
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          (state.pressed || hovered(state)) && styles.pressed,
        ]}
      >
        <View style={{ width: 26 * k, height: 26 * k }} importantForAccessibility="no-hide-descendants">
          {/* arrow head */}
          <View
            style={[
              styles.head,
              { left: 13 * k - 6.5 * k, top: 1 * k, width: 13 * k, height: 13 * k, borderTopWidth: 3 * k, borderLeftWidth: 3 * k },
            ]}
          />
          {/* arrow shaft */}
          <View style={[styles.line, { left: 13 * k - 1.5 * k, top: 2 * k, width: 3 * k, height: 15 * k }]} />
          {/* tray */}
          <View style={[styles.line, { left: 0, top: 16 * k, width: 3 * k, height: 10 * k }]} />
          <View style={[styles.line, { right: 0, top: 16 * k, width: 3 * k, height: 10 * k }]} />
          <View style={[styles.line, { left: 0, top: 23 * k, width: 26 * k, height: 3 * k }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  dim: { opacity: 0.4 },
  line: { position: 'absolute', backgroundColor: colors.accentText, borderRadius: radius.pill },
  head: { position: 'absolute', borderColor: colors.accentText, transform: [{ rotate: '45deg' }], borderRadius: 2 },
});
