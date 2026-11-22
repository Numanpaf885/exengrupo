import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import { Text } from './Text';

const TAPS = 7;
const WINDOW_MS = 4000;

/**
 * The big "exengrupo" title. Tapping it 7 times within 4 seconds opens the
 * hidden admin panel (/admin). No visual feedback, not announced as a button.
 */
export function HiddenAdminTitle() {
  const router = useRouter();
  const taps = useRef<number[]>([]);
  const onPress = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS), now];
    if (taps.current.length >= TAPS) {
      taps.current = [];
      router.push('/admin');
    }
  };
  return (
    <Pressable onPress={onPress} accessible={false} style={{ alignSelf: 'flex-start' }}>
      <Text variant="display">exengrupo</Text>
    </Pressable>
  );
}
