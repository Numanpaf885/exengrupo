import { useEffect, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { duration, easeInOut, nativeDriver, reducedMotion } from '@/theme/motion';

/**
 * Indeterminate progress: a red capsule sweeping along a rounded 4 px track. With
 * reduced motion it is a still bar. `label` is announced to screen readers.
 */
export function LoadingBar({ label, inverted }: { label: string; inverted?: boolean }) {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!width || reducedMotion()) return;
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: easeInOut, useNativeDriver: nativeDriver }),
    );
    loop.start();
    return () => loop.stop();
  }, [width, x]);
  const block = Math.max(space(4), width / 3);
  const fg = inverted ? colors.white : colors.accentText;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: inverted ? 'rgba(255,255,255,0.25)' : colors.fill }]}
    >
      <Animated.View
        style={[
          styles.block,
          {
            width: block,
            backgroundColor: fg,
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-block, width] }) }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, overflow: 'hidden', borderRadius: radius.pill },
  block: { height: 4, borderRadius: radius.pill },
});
