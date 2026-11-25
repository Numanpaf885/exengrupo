import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { cachedCanCreate, cachedSpaces, loadSpaces, prefetchSpace } from '@/features/spaces/cache';
import { UpdateBanner } from '@/features/update/UpdateBanner';
import { confirmAction } from '@/lib/confirm';
import { takePendingJoin } from '@/lib/pendingJoin';
import { space } from '@/theme/tokens';

const members = (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`);

export default function Home() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceSummary[] | null>(() => cachedSpaces() ?? null);
  // Only people the admin allowed may create spaces; everyone else is added by them (or joins with a code).
  const [canCreate, setCanCreate] = useState(cachedCanCreate);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const signOut = async () => {
    const ok = await confirmAction('Cerrar sesión', '¿Cerrar sesión en este dispositivo?', 'Cerrar sesión');
    if (ok) await logout();
  };

  const load = useCallback(async () => {
    if (!token) return;
    const res = await loadSpaces(token);
    if (res.ok) {
      setSpaces(res.data.spaces);
      setCanCreate(res.data.can_create === true);
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
          {canCreate && <Button label="Crear espacio" onPress={() => router.push('/crear')} flex />}
          <Button label={canCreate ? 'Unirme' : 'Unirme con código'} kind="secondary" onPress={() => router.push('/unirse')} flex />
        </>
      }
    >
      <View>
        <HiddenAdminTitle />
        <Text tone="secondary">Hola, {user?.username}</Text>
      </View>

      <UpdateBanner />
      <Notice text={error} />
      {spaces === null && !error && <LoadingBar label="Cargando…" />}
      {spaces?.length === 0 && (
        <FadeIn>
          <Card>
            <Text variant="headline">Aún no tienes espacios</Text>
            <Text tone="secondary">
              {canCreate
                ? 'Crea uno para tu grupo de estudio y elige con quién compartirlo.'
                : 'Cuando alguien te añada a un espacio, aparecerá aquí. También puedes unirte con el código de 6 letras que te pasen.'}
            </Text>
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

      {/* Lens test and sign out stay out of sight until "Más" is tapped. */}
      <View style={styles.more}>
        <Button kind="ghost" label={showMore ? 'Menos' : 'Más'} onPress={() => setShowMore((v) => !v)} />
      </View>
      {showMore && (
        <FadeIn>
          <Section>
            <ListRow label="Prueba de lente" onPress={() => router.push('/lente')}>
              <Text>Prueba de lente</Text>
            </ListRow>
            <ListRow label="Cerrar sesión" onPress={() => void signOut()}>
              <Text tone="accent">Cerrar sesión</Text>
            </ListRow>
          </Section>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ more: { alignItems: 'center', marginTop: 'auto', paddingTop: space(1) } });
