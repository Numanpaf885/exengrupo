import { useRef } from 'react';
import { Animated } from 'react-native';
import { duration, nativeDriver, reducedMotion } from '@/theme/motion';

/** A quick scale-down while pressed, springing back on release. */
export function usePressScale(to = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    if (reducedMotion()) return;
    if (value < 1) {
      Animated.timing(scale, { toValue: value, duration: duration.press, useNativeDriver: nativeDriver }).start();
    } else {
      Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 6, useNativeDriver: nativeDriver }).start();
    }
  };
  return {
    style: { transform: [{ scale }] },
    onPressIn: () => animate(to),
    onPressOut: () => animate(1),
  };
}
