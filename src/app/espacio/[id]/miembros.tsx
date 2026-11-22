import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthContext';
import { type SpaceDetail, spacesApi } from '@/features/spaces/api';
import { loadSpace } from '@/features/spaces/cache';
import { memo } from '@/lib/memo';
import { confirmAction } from '@/lib/confirm';
import { SPACE_NAME_MAX, spaceNameError } from '@/lib/spaces/validation';
import { space as grid } from '@/theme/tokens';

export default function Miembros() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = String(id);
  const { token, user } = useAuth();
  const router = useRouter();
  const [space, setSpace] = useState<SpaceDetail | null>(() => memo.get<SpaceDetail>(`space:${spaceId}`) ?? null);
  const [name, setName] = useState(() => space?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await loadSpace(token, spaceId);
    if (res.ok) {
      setSpace(res.data.space);
      setName(res.data.space.name);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [token, spaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, done?: () => void) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? null);
    done?.();
  };

  const rename = () => {
    const invalid = spaceNameError(name);
    if (invalid) return setError(invalid);
    if (!token) return;
    void run(
      () => spacesApi.rename(token, spaceId, name),
      () => {
        setSaved('Nombre guardado.');
        void load();
      },
    );
  };

  const removeMember = async (userId: string, username: string) => {
    if (!token) return;
    const ok = await confirmAction('Quitar miembro', `¿Quitar a ${username} del espacio?`, 'Quitar');
    if (ok) void run(() => spacesApi.removeMember(token, spaceId, userId), () => void load());
  };

  const deleteSpace = async () => {
    if (!token || !space) return;
    const ok = await confirmAction(
      'Eliminar espacio',
      `¿Eliminar "${space.name}"? Nadie podrá volver a entrar.`,
      'Eliminar',
    );
    if (ok) void run(() => spacesApi.remove(token, spaceId), () => router.replace('/'));
  };

  return (
    <Screen onBack={() => router.back()}>
      <Text variant="display">Miembros</Text>
      <Notice text={error} />
      {!space && !error && <LoadingBar label="Cargando…" />}
      <View>
        {space?.members.map((m, i) => (
          <FadeIn key={m.user_id} index={i}>
            <ListRow>
              <View style={styles.member}>
                <View style={styles.grow}>
                  <Text variant="title" numberOfLines={1}>
                    {m.username}
                  </Text>
                  <Text>
                    {m.is_creator ? 'Creador del espacio' : 'Miembro'}
                    {m.user_id === user?.user_id ? ' · tú' : ''}
                  </Text>
                </View>
                {space.is_creator && !m.is_creator && (
                  <Button
                    label="Quitar"
                    kind="ghost"
                    onPress={() => void removeMember(m.user_id, m.username)}
                    disabled={busy}
                  />
                )}
              </View>
            </ListRow>
          </FadeIn>
        ))}
      </View>

      {space?.is_creator && (
        <View style={styles.block}>
          <ListRow>
            <Text variant="title">Ajustes</Text>
          </ListRow>
          <TextField
            label="Nombre del espacio"
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            maxLength={SPACE_NAME_MAX}
          />
          <Notice text={saved} />
          <Button label={busy ? 'Guardando…' : 'Guardar nombre'} onPress={rename} disabled={busy} />
          <Button label="Eliminar espacio" kind="secondary" onPress={() => void deleteSpace()} disabled={busy} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: grid(2) },
  member: { flexDirection: 'row', alignItems: 'center', gap: grid(2) },
  grow: { flex: 1 },
});
