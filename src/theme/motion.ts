/**
 * Motion tokens. Short, purposeful, and skipped entirely when the phone asks
 * for reduced motion. Only opacity and transform are animated (cheap on the
 * GPU; never width/height).
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

export const duration = {
  /** Press feedback. */
  press: 90,
  /** Elements entering the screen. */
  enter: 260,
  /** Elements leaving (faster than entering). */
  exit: 160,
  /** Stagger between list rows. */
  stagger: 40,
} as const;

/** Swiss motion is calm: a strong ease-out, no bounce on layout. */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** The native driver isn't available on web. */
export const nativeDriver = Platform.OS !== 'web';

let reduced = false;
const listeners = new Set<(v: boolean) => void>();
void AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reduced = !!v;
    listeners.forEach((l) => l(reduced));
  })
  .catch(() => undefined);
AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
  reduced = !!v;
  listeners.forEach((l) => l(reduced));
});

/** True when the user turned on "reduce motion"; animations then jump to their end state. */
export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reduced);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduced);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

export function reducedMotion(): boolean {
  return reduced;
}
