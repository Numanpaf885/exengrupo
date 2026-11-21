/** Join link: https://exengrupo.vercel.app/unirse/ABCDEF */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { spacesApi } from '@/features/spaces/api';
import { setPendingJoin } from '@/lib/pendingJoin';
import { space } from '@/theme/tokens';

export default function UnirseConEnlace() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = String(raw ?? '').toUpperCase();
  const { status, token } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status !== 'signedIn' || !token || started.current) return;
    started.current = true;
    void spacesApi.join(token, code).then((res) => {
      if (res.ok) router.replace(`/espacio/${res.data.space.space_id}`);
      else setError(res.error);
    });
  }, [status, token, code, router]);

  if (status === 'signedOut') {
    return (
      <Screen>
        <Text variant="display">exengrupo</Text>
        <Text variant="title">Te invitaron a un espacio</Text>
        <Text>Código {code}. Entra o crea una cuenta y te unirás al momento.</Text>
        <View style={styles.block}>
          <Button
            label="Entrar"
            onPress={() => {
              setPendingJoin(code);
              router.replace('/login');
            }}
          />
          <Button
            label="Crear cuenta"
            kind="secondary"
            onPress={() => {
              setPendingJoin(code);
              router.replace('/register');
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen onBack={() => router.replace('/')}>
      <Text variant="display">Unirme</Text>
      {error ? <Notice text={error} /> : <Text>Uniéndote al espacio {code}…</Text>}
      {error && <Button label="Ir a mis espacios" kind="secondary" onPress={() => router.replace('/')} />}
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: space(2) } });
