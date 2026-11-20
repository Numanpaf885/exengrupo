import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { space } from '@/theme/tokens';

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <Screen>
      <Text variant="display">exengrupo</Text>
      <View style={styles.block}>
        <Text variant="label">Sesión iniciada</Text>
        <Text variant="title">{user?.username}</Text>
      </View>
      <View style={styles.block}>
        <Button label="Prueba de lente" kind="secondary" onPress={() => router.push('/lente')} />
        <Button label="Cerrar sesión" kind="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: space(2) } });
