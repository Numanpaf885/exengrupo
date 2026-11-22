import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import { shutterTick } from './Shutter';
import { Text } from './Text';

const TAPS = 7;
const WINDOW_MS = 4000;
const HOLD_MS = 3000;

/**
 * The big "exengrupo" title (home and sign-in screens). Two hidden ways open
 * the admin panel (/admin): hold it for 3 seconds, or tap it 7 times within
 * 4 seconds. A short vibration on the phone confirms. Not announced as a button.
 */
export function HiddenAdminTitle() {
  const router = useRouter();
  const taps = useRef<number[]>([]);
  const open = () => {
    taps.current = [];
    shutterTick();
    router.push('/admin');
  };
  const onPress = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS), now];
    if (taps.current.length >= TAPS) open();
  };
  return (
    <Pressable
      onPress={onPress}
      onLongPress={open}
      delayLongPress={HOLD_MS}
      accessible={false}
      style={{ alignSelf: 'flex-start' }}
    >
      <Text variant="display">exengrupo</Text>
    </Pressable>
  );
}
