import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { HiddenAdminTitle } from '@/components/HiddenAdminTitle';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import type { SpaceSummary } from '@/features/spaces/api';
import { cachedSpaces, loadSpaces, prefetchSpace } from '@/features/spaces/cache';
import { takePendingJoin } from '@/lib/pendingJoin';
import { rule, space } from '@/theme/tokens';

const members = (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`);

export default function Home() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(() => cachedSpaces() ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await loadSpaces(token);
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

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={refreshing}
      footer={
        <>
          <Button label="Crear espacio" onPress={() => router.push('/crear')} flex />
          <Button label="Unirme" kind="secondary" onPress={() => router.push('/unirse')} flex trailing="→" />
        </>
      }
    >
      <View>
        <HiddenAdminTitle />
        <Text variant="label">Hola, {user?.username}</Text>
      </View>

      <View style={styles.block}>
        <Text variant="title">Tus espacios</Text>
        <Notice text={error} />
        {spaces === null && !error && <LoadingBar label="Cargando…" />}
        {spaces?.length === 0 && (
          <FadeIn>
            <View style={styles.empty}>
              <Text variant="title">Aún no tienes espacios.</Text>
              <Text>Crea uno para tu grupo de estudio o únete con el código de 6 letras que te pasaron.</Text>
            </View>
          </FadeIn>
        )}
        <View style={spaces?.length ? styles.list : undefined}>
          {spaces?.map((s, i) => (
            <FadeIn key={s.space_id} index={i}>
              <ListRow
                label={s.name}
                onPressIn={() => token && prefetchSpace(token, s.space_id)}
                onPress={() => router.push(`/espacio/${s.space_id}`)}
              >
                <Text variant="title" numberOfLines={2}>
                  {s.name}
                </Text>
                <Text>
                  {members(s.member_count)}
                  {s.is_creator ? ' · creado por ti' : ''}
                </Text>
              </ListRow>
            </FadeIn>
          ))}
        </View>
        {error && <Button label="Reintentar" kind="secondary" onPress={() => void load()} />}
      </View>

      <View style={styles.more}>
        <Button kind="ghost" label="Prueba de lente" onPress={() => router.push('/lente')} trailing="→" />
        <Button kind="ghost" label="Cerrar sesión" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space(2) },
  list: { borderBottomWidth: rule.width, borderBottomColor: rule.color },
  empty: { gap: space(1), paddingVertical: space(2) },
  more: { marginTop: 'auto', paddingTop: space(4) },
});
