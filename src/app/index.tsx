import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { Badge, initials } from '@/components/Badge';
import { HiddenAdminTitle } from '@/components/HiddenAdminTitle';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Card, Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthContext';
import type { SpaceSummary } from '@/features/spaces/api';
import { cachedSpaces, loadSpaces, prefetchSpace } from '@/features/spaces/cache';
import { takePendingJoin } from '@/lib/pendingJoin';

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
          <Button label="Unirme" kind="secondary" onPress={() => router.push('/unirse')} flex />
        </>
      }
    >
      <View>
        <HiddenAdminTitle />
        <Text tone="secondary">Hola, {user?.username}</Text>
      </View>

      <Notice text={error} />
      {spaces === null && !error && <LoadingBar label="Cargando…" />}
      {spaces?.length === 0 && (
        <FadeIn>
          <Card>
            <Text variant="headline">Aún no tienes espacios</Text>
            <Text tone="secondary">Crea uno para tu grupo de estudio o únete con el código de 6 letras que te pasaron.</Text>
          </Card>
        </FadeIn>
      )}
      {!!spaces?.length && (
        <Section title="Tus espacios">
          {spaces.map((s, i) => (
            <FadeIn key={s.space_id} index={i}>
              <ListRow
                label={s.name}
                leading={<Badge text={initials(s.name)} />}
                onPressIn={() => token && prefetchSpace(token, s.space_id)}
                onPress={() => router.push(`/espacio/${s.space_id}`)}
              >
                <Text variant="headline" numberOfLines={1}>
                  {s.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {members(s.member_count)}
                  {s.is_creator ? ' · creado por ti' : ''}
                </Text>
              </ListRow>
            </FadeIn>
          ))}
        </Section>
      )}
      {error && <Button label="Reintentar" kind="secondary" onPress={() => void load()} />}

      <Section>
        <ListRow label="Prueba de lente" onPress={() => router.push('/lente')}>
          <Text>Prueba de lente</Text>
        </ListRow>
        <ListRow label="Cerrar sesión" onPress={() => void logout()}>
          <Text tone="accent">Cerrar sesión</Text>
        </ListRow>
      </Section>
    </Screen>
  );
}
