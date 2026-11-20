import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}
