import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { colors } from '@/theme/tokens';

const blank = <View style={{ flex: 1, backgroundColor: colors.background }} />;

function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') return blank;
  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lente" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_700Bold });
  if (!loaded) return blank;
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
