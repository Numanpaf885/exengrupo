import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { HiddenAdminTitle } from '@/components/HiddenAdminTitle';
import { ListRow } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import { type SpaceSummary, spacesApi } from '@/features/spaces/api';
import { takePendingJoin } from '@/lib/pendingJoin';
import { space } from '@/theme/tokens';

const members = (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`);

export default function Home() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await spacesApi.list(token);
    if (res.ok) {
      setSpaces(res.data.spaces);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      const code = takePendingJoin();
      if (code) {
        router.push(`/unirse/${code}`);
        return;
      }
      void load();
    }, [load, router]),
  );

  return (
    <Screen>
      <HiddenAdminTitle />

      <View style={styles.block}>
        <Text variant="title">Tus espacios</Text>
        <Notice text={error} />
        {spaces === null && !error && <Text>Cargando…</Text>}
        {spaces?.length === 0 && <Text>Aún no tienes espacios. Crea uno o únete con un código.</Text>}
        <View>
          {spaces?.map((s) => (
            <ListRow key={s.space_id} label={s.name} onPress={() => router.push(`/espacio/${s.space_id}`)}>
              <Text variant="title">{s.name}</Text>
              <Text>
                {members(s.member_count)}
                {s.is_creator ? ' · creado por ti' : ''}
              </Text>
            </ListRow>
          ))}
        </View>
        {error && <Button label="Reintentar" kind="secondary" onPress={() => void load()} />}
      </View>

      <View style={styles.block}>
        <Button label="Crear espacio" onPress={() => router.push('/crear')} />
        <Button label="Unirme con código" kind="secondary" onPress={() => router.push('/unirse')} />
      </View>

      <ListRow>
        <Text variant="label">Sesión iniciada: {user?.username}</Text>
      </ListRow>
      <View style={styles.block}>
        <Button label="Prueba de lente" kind="secondary" onPress={() => router.push('/lente')} />
        <Button label="Cerrar sesión" kind="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: space(2) } });
