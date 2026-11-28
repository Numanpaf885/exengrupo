import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Badge, initials } from '@/components/Badge';
import { FadeIn } from '@/components/FadeIn';
import { ListRow } from '@/components/ListRow';
import { LoadingBar } from '@/components/LoadingBar';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthContext';
import { type SpaceDetail, spacesApi } from '@/features/spaces/api';
import { cachedPeople, loadPeople, loadSpace } from '@/features/spaces/cache';
import { PeoplePicker } from '@/features/spaces/PeoplePicker';
import { pickedSummary } from '@/lib/spaces/people';
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
  const [adding, setAdding] = useState(false);
  const [people, setPeople] = useState(() => cachedPeople() ?? null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inSpace = useMemo(() => new Set(space?.members.map((m) => m.user_id) ?? []), [space]);

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

  const openAdd = () => {
    setAdding(true);
    setPicked(new Set());
    if (!token) return;
    void loadPeople(token).then((res) => {
      if (res.ok) setPeople(res.data.people);
      else {
        setPeople((p) => p ?? []);
        setError(res.error);
      }
    });
  };

  const addPicked = () => {
    if (!token || picked.size === 0) return;
    const count = picked.size;
    void run(
      () => spacesApi.addMembers(token, spaceId, [...picked]),
      () => {
        setAdding(false);
        setPicked(new Set());
        setSaved(count === 1 ? 'Persona añadida.' : `${count} personas añadidas.`);
        void load();
      },
    );
  };

  const removeMember = async (userId: string, username: string) => {
    if (!token) return;
    const ok = await confirmAction('Quitar miembro', `¿Quitar a ${username} del espacio?`, 'Quitar');
    if (ok) void run(() => spacesApi.removeMember(token, spaceId, userId), () => void load());
  };

  const toggleArchive = async () => {
    if (!token || !space) return;
    const archive = !space.archived;
    const ok = archive
      ? await confirmAction(
          'Archivar espacio',
          `¿Archivar "${space.name}"? Los miembros dejarán de verlo y su código no funcionará. Tú lo verás en «Archivados» y podrás recuperarlo.`,
          'Archivar',
        )
      : true;
    if (!ok) return;
    void run(
      () => spacesApi.archive(token, spaceId, archive),
      () => {
        setSaved(archive ? 'Espacio archivado.' : 'Espacio recuperado: los miembros vuelven a verlo.');
        void load();
      },
    );
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
      {!!space?.members.length && (
        <Section title={`${space.members.length} miembros`}>
          {space.members.map((m, i) => (
            <FadeIn key={m.user_id} index={i}>
              <ListRow
                leading={<Badge text={initials(m.username)} round tone={m.is_creator ? 'accent' : 'neutral'} />}
                trailing={
                  space.is_creator && !m.is_creator ? (
                    <Button kind="ghost" label="Quitar" onPress={() => void removeMember(m.user_id, m.username)} disabled={busy} />
                  ) : null
                }
              >
                <Text variant="headline" numberOfLines={1}>
                  {m.username}
                  {m.user_id === user?.user_id ? ' (tú)' : ''}
                </Text>
                <Text variant="caption" tone="secondary">
                  {m.is_creator ? 'Creador del espacio' : 'Miembro'}
                </Text>
              </ListRow>
            </FadeIn>
          ))}
        </Section>
      )}

      {space?.is_creator && (
        <View style={styles.block}>
          <Text variant="title">Añadir miembros</Text>
          {adding ? (
            <>
              <PeoplePicker
                title="Elige a quién añadir"
                people={people}
                selected={picked}
                onChange={setPicked}
                exclude={inSpace}
                footer="Lo verán en su lista al momento, sin código."
              />
              {picked.size > 0 && (
                <Text tone="secondary">
                  {pickedSummary(
                    picked.size,
                    (people ?? []).filter((p) => picked.has(p.user_id)).map((p) => p.username),
                  )}
                </Text>
              )}
              <Button
                label={busy ? 'Añadiendo…' : 'Añadir'}
                onPress={addPicked}
                disabled={busy || picked.size === 0}
              />
              <Button label="Cancelar" kind="secondary" onPress={() => setAdding(false)} disabled={busy} />
            </>
          ) : (
            <Button label="Añadir miembros" kind="secondary" onPress={openAdd} disabled={busy} />
          )}
        </View>
      )}

      {space?.is_creator && (
        <View style={styles.block}>
          <Text variant="title">Ajustes</Text>
          <TextField
            label="Nombre del espacio"
            value={name}
            onChangeText={setName}
            autoCapitalize="sentences"
            maxLength={SPACE_NAME_MAX}
          />
          <Notice text={saved} tone="success" />
          <Button label={busy ? 'Guardando…' : 'Guardar nombre'} onPress={rename} disabled={busy} />
          <Button
            label={space.archived ? 'Desarchivar espacio' : 'Archivar espacio'}
            kind="secondary"
            onPress={() => void toggleArchive()}
            disabled={busy}
          />
          <Button label="Eliminar espacio" kind="destructive" onPress={() => void deleteSpace()} disabled={busy} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: grid(2) } });
