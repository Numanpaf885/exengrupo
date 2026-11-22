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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 260,
        gestureEnabled: true,
      }}
    >
      <Stack.Protected guard={signedIn} redirectTo="/login">
        <Stack.Screen name="index" />
        <Stack.Screen name="crear" />
        <Stack.Screen name="unirse/index" />
        <Stack.Screen name="espacio/[id]/index" />
        <Stack.Screen
          name="espacio/[id]/camara"
          options={{ animation: 'fade_from_bottom', contentStyle: { backgroundColor: colors.text } }}
        />
        <Stack.Screen name="espacio/[id]/miembros" />
        <Stack.Screen name="espacio/[id]/archivos" />
        <Stack.Screen name="lente" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="login" />
        <Stack.Screen name="activar" />
      </Stack.Protected>
      {/* Join links work signed in or out (signed out: log in first, then join). */}
      <Stack.Screen name="unirse/[code]" />
      {/* Hidden admin panel: tap the "exengrupo" title 7 times. Has its own password. */}
      <Stack.Screen name="admin" />
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
