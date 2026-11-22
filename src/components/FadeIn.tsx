import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { duration, easeOut, nativeDriver, reducedMotion } from '@/theme/motion';

/**
 * Fades its children in while sliding them up 16 px. `index` staggers rows of a
 * list. Runs once, on mount.
 */
export function FadeIn({
  children,
  index = 0,
  offset = 16,
  style,
}: {
  children: ReactNode;
  index?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const skip = reducedMotion();
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;
  useEffect(() => {
    if (skip) return;
    Animated.timing(progress, {
      toValue: 1,
      duration: duration.enter,
      delay: Math.min(index, 8) * duration.stagger,
      easing: easeOut,
      useNativeDriver: nativeDriver,
    }).start();
  }, [progress, index, skip]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
