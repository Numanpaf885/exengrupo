import { useCallback, useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Switch, View } from 'react-native';
import { Button } from '@/components/Button';
import { ListRow } from '@/components/ListRow';
import { Notice } from '@/components/Notice';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { usernameError } from '@/lib/auth/validation';
import { WEB_URL } from '@/lib/config';
import { confirmAction } from '@/lib/confirm';
import { colors, radius, space } from '@/theme/tokens';
import { type AdminUser, adminApi, type CodeResult } from './api';
import { activationLink, formatDateTime, inviteMessage, userStatusText } from './format';

function CodeCard({ result, onClose }: { result: CodeResult; onClose: () => void }) {
  const link = activationLink(WEB_URL, result.user.username);
  const share = () =>
    void Share.share({ message: inviteMessage(result.user.username, result.code, link) }).catch(() => undefined);
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text variant="label">Código de un solo uso para {result.user.username}</Text>
      <Text variant="label" selectable style={styles.code}>
        {result.code}
      </Text>
      <Text>
        Caduca el {formatDateTime(result.expires_at)}. Solo se muestra ahora: compártelo antes de cerrar. Se activa en{' '}
        {link}
        {Platform.OS === 'web' ? '' : ' o en la app con «Tengo un código»'}.
      </Text>
      <Button label="Compartir código" onPress={share} />
      <Button label="Listo" kind="secondary" onPress={onClose} />
    </View>
  );
}

export function UsersPanel({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState<CodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (res: { ok: boolean; status?: number; error?: string }) => {
      if (!res.ok && res.status === 401) onSessionEnded();
      else if (!res.ok) setError(res.error ?? null);
      return res.ok;
    },
    [onSessionEnded],
  );

  const load = useCallback(async () => {
    const res = await adminApi.users();
    if (handle(res) && res.ok) {
      setUsers(res.data.users);
      setError(null);
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const invalid = usernameError(username);
    if (invalid) return setError(invalid);
    setBusy(true);
    setError(null);
    const res = await adminApi.create(username);
    setBusy(false);
    if (handle(res) && res.ok) {
      setCode(res.data);
      setUsername('');
      void load();
    }
  };

  const reset = async (u: AdminUser) => {
    const ok = await confirmAction(
      'Nuevo código',
      `¿Dar un código nuevo a ${u.username}? Su contraseña dejará de funcionar y se cerrará su sesión en todos sus dispositivos.`,
      'Dar código',
    );
    if (!ok) return;
    setBusy(true);
    const res = await adminApi.reset(u.user_id);
    setBusy(false);
    if (handle(res) && res.ok) {
      setCode(res.data);
      void load();
    }
  };

  const toggleCreator = async (u: AdminUser, canCreate: boolean) => {
    // Show the change at once; reload puts it back if the server refused.
    setUsers((list) => list?.map((x) => (x.user_id === u.user_id ? { ...x, can_create: canCreate } : x)) ?? null);
    const res = await adminApi.setCreator(u.user_id, canCreate);
    if (!handle(res)) void load();
  };

  const remove = async (u: AdminUser) => {
    const ok = await confirmAction(
      'Eliminar usuario',
      `¿Eliminar a ${u.username}? No podrá entrar y saldrá de todos sus espacios.`,
      'Eliminar',
    );
    if (!ok) return;
    setBusy(true);
    const res = await adminApi.remove(u.user_id);
    setBusy(false);
    if (handle(res)) void load();
  };

  return (
    <View style={styles.block}>
      {code ? (
        <CodeCard result={code} onClose={() => setCode(null)} />
      ) : (
        <View style={styles.block}>
          <TextField
            label="Usuario nuevo"
            value={username}
            onChangeText={setUsername}
            maxLength={20}
            returnKeyType="go"
            onSubmitEditing={() => void create()}
          />
          <Button label={busy ? 'Creando…' : 'Crear y dar código'} onPress={() => void create()} disabled={busy} />
        </View>
      )}
      <Notice text={error} />
      <View>
        {users === null && !error && <Text>Cargando…</Text>}
        {users?.length === 0 && <Text>Aún no hay usuarios.</Text>}
        {users?.map((u) => (
          <ListRow key={u.user_id}>
            <Text variant="title">{u.username}</Text>
            <Text>{userStatusText(u)}</Text>
            <Text>{u.spaces === 1 ? '1 espacio' : `${u.spaces} espacios`}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.grow}>Puede crear espacios</Text>
              <Switch
                accessibilityLabel={`${u.username} puede crear espacios`}
                value={u.can_create}
                onValueChange={(v) => void toggleCreator(u, v)}
                trackColor={{ true: colors.accent, false: colors.fill }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.fill}
                // react-native-web reads the "on" thumb colour from its own prop (default teal).
                {...({ activeThumbColor: colors.white } as object)}
              />
            </View>
            <View style={styles.rowActions}>
              <Button label="Nuevo código" kind="secondary" onPress={() => void reset(u)} disabled={busy} />
              <Button label="Eliminar" kind="secondary" onPress={() => void remove(u)} disabled={busy} />
            </View>
          </ListRow>
        ))}
      </View>
      {users && <Button label="Actualizar" kind="secondary" onPress={() => void load()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space(2) },
  rowActions: { gap: space(1), marginTop: space(1) },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginTop: space(1) },
  grow: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space(2), gap: space(2) },
  // 14 characters on one line even at 360 px.
  code: { fontSize: 24, lineHeight: 32 },
});
