/**
 * Admin → Espacios: every space with its members. The admin creates a space for
 * anyone (picks its creator and members), adds or removes members of any space
 * (not its creator) and deletes spaces (soft delete, like the creator's button).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, initials } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Section } from '@/components/Section';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { PeoplePicker } from '@/features/spaces/PeoplePicker';
import { confirmAction } from '@/lib/confirm';
import { pickedSummary, type Person } from '@/lib/spaces/people';
import { SPACE_NAME_MAX, spaceNameError } from '@/lib/spaces/validation';
import { rule, space } from '@/theme/tokens';
import { type AdminSpace, adminApi } from './api';
import { formatDateTime } from './format';

type Res = { ok: boolean; status?: number; error?: string };

function NewSpaceForm({
  people,
  busy,
  onCreate,
  onCancel,
}: {
  people: Person[];
  busy: boolean;
  onCreate: (body: { name: string; creator_id: string; member_ids: string[] }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [creator, setCreator] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const exclude = useMemo(() => new Set(creator ? [creator] : []), [creator]);

  const submit = () => {
    const invalid = spaceNameError(name);
    if (invalid) return setError(invalid);
    if (!creator) return setError('Elige quién crea el espacio.');
    setError(null);
    onCreate({ name, creator_id: creator, member_ids: [...picked].filter((id) => id !== creator) });
  };

  return (
    <View style={styles.card}>
      <Text variant="headline">Nuevo espacio</Text>
      <TextField
        label="Nombre del espacio"
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        maxLength={SPACE_NAME_MAX}
      />
      <Section title="Creador (puede renombrarlo, añadir y quitar)">
        {people.map((p) => (
          <ListRow
            key={p.user_id}
            label={p.username}
            checked={creator === p.user_id}
            onPress={() => setCreator(p.user_id)}
            leading={<Badge text={initials(p.username)} round tone="neutral" />}
          >
            <Text variant="headline" numberOfLines={1}>
              {p.username}
            </Text>
          </ListRow>
        ))}
      </Section>
      <PeoplePicker title="Miembros" people={people} selected={picked} onChange={setPicked} exclude={exclude} />
      <Notice text={error} />
      <Button label={busy ? 'Creando…' : 'Crear espacio'} onPress={submit} disabled={busy} />
      <Button label="Cancelar" kind="secondary" onPress={onCancel} disabled={busy} />
    </View>
  );
}

function SpaceCard({
  s,
  people,
  busy,
  run,
}: {
  s: AdminSpace;
  people: Person[];
  busy: boolean;
  run: (action: () => Promise<Res>) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inSpace = useMemo(() => new Set(s.members.map((m) => m.user_id)), [s.members]);
  const creator = s.members.find((m) => m.is_creator)?.username ?? '—';

  const add = async () => {
    if (picked.size === 0) return;
    if (await run(() => adminApi.addMembers(s.space_id, [...picked]))) {
      setAdding(false);
      setPicked(new Set());
    }
  };

  const removeMember = async (userId: string, username: string) => {
    if (await confirmAction('Quitar miembro', `¿Quitar a ${username} de "${s.name}"?`, 'Quitar')) {
      await run(() => adminApi.removeMember(s.space_id, userId));
    }
  };

  const remove = async () => {
    const ok = await confirmAction('Eliminar espacio', `¿Eliminar "${s.name}"? Nadie podrá volver a entrar.`, 'Eliminar');
    if (ok) await run(() => adminApi.deleteSpace(s.space_id));
  };

  return (
    <View style={styles.card}>
      <View>
        <Text variant="headline">{s.name}</Text>
        <Text variant="caption" tone="secondary">
          Código {s.join_code} · creado por {creator} · {formatDateTime(s.created_at)}
        </Text>
      </View>
      <Section title={s.members.length === 1 ? '1 miembro' : `${s.members.length} miembros`}>
        {s.members.map((m) => (
          <ListRow
            key={m.user_id}
            leading={<Badge text={initials(m.username)} round tone={m.is_creator ? 'accent' : 'neutral'} />}
            trailing={
              m.is_creator ? null : (
                <Button kind="ghost" label="Quitar" onPress={() => void removeMember(m.user_id, m.username)} disabled={busy} />
              )
            }
          >
            <Text variant="headline" numberOfLines={1}>
              {m.username}
            </Text>
            <Text variant="caption" tone="secondary">
              {m.is_creator ? 'Creador' : 'Miembro'}
            </Text>
          </ListRow>
        ))}
      </Section>
      {adding ? (
        <>
          <PeoplePicker title="Añadir" people={people} selected={picked} onChange={setPicked} exclude={inSpace} />
          {picked.size > 0 && (
            <Text tone="secondary">
              {pickedSummary(
                picked.size,
                people.filter((p) => picked.has(p.user_id)).map((p) => p.username),
              )}
            </Text>
          )}
          <Button label={busy ? 'Añadiendo…' : 'Añadir'} onPress={() => void add()} disabled={busy || picked.size === 0} />
          <Button label="Cancelar" kind="secondary" onPress={() => setAdding(false)} disabled={busy} />
        </>
      ) : (
        <View style={styles.row}>
          <Button label="Añadir" kind="secondary" onPress={() => setAdding(true)} disabled={busy} flex />
          <Button label="Eliminar" kind="destructive" onPress={() => void remove()} disabled={busy} flex />
        </View>
      )}
    </View>
  );
}

export function SpacesPanel({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [spaces, setSpaces] = useState<AdminSpace[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const handle = useCallback(
    (res: Res) => {
      if (!res.ok && res.status === 401) onSessionEnded();
      else if (!res.ok) setError(res.error ?? null);
      return res.ok;
    },
    [onSessionEnded],
  );

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([adminApi.spaces(), adminApi.users()]);
    if (handle(s) && s.ok) {
      setSpaces(s.data.spaces);
      setError(null);
    }
    if (u.ok) setPeople(u.data.users.map((x) => ({ user_id: x.user_id, username: x.username })));
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<Res>, message = 'Hecho.') => {
      setBusy(true);
      setError(null);
      setDone(null);
      const res = await action();
      setBusy(false);
      const ok = handle(res);
      if (ok) {
        setDone(message);
        void load();
      }
      return ok;
    },
    [handle, load],
  );

  const create = async (body: { name: string; creator_id: string; member_ids: string[] }) => {
    if (await run(() => adminApi.createSpace(body), 'Espacio creado. Sus miembros ya lo ven en su lista.')) setCreating(false);
  };

  return (
    <View style={styles.block}>
      {creating ? (
        <NewSpaceForm people={people} busy={busy} onCreate={(b) => void create(b)} onCancel={() => setCreating(false)} />
      ) : (
        <Button label="Crear espacio para alguien" onPress={() => setCreating(true)} disabled={busy} />
      )}
      <Notice text={error} />
      <Notice text={done} tone="success" />
      {spaces === null && !error && <Text>Cargando…</Text>}
      {spaces?.length === 0 && <Text tone="secondary">Aún no hay espacios.</Text>}
      {spaces?.map((s) => <SpaceCard key={s.space_id} s={s} people={people} busy={busy} run={run} />)}
      {spaces && <Button label="Actualizar" kind="secondary" onPress={() => void load()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space(2) },
  row: { flexDirection: 'row', gap: space(1) },
  // Sections inside already draw the cards; a hairline separates one space from the next.
  card: { gap: space(1.5), paddingTop: space(2), borderTopWidth: rule.width, borderTopColor: rule.color },
});
