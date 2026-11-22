/** Hidden admin panel (tap the "exengrupo" title 7 times). Own password: ADMIN_PASSWORD in Vercel. */
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { adminApi, getAdminToken, setAdminToken } from '@/features/admin/api';
import { KeysPanel } from '@/features/admin/KeysPanel';
import { UsersPanel } from '@/features/admin/UsersPanel';
import { space } from '@/theme/tokens';

type Tab = 'users' | 'keys';

export default function Admin() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(() => !!getAdminToken());
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('users');

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const signIn = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    const res = await adminApi.login(password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setAdminToken(res.data.token);
    setPassword('');
    setSignedIn(true);
  };

  const signOut = useCallback(() => {
    setAdminToken(null);
    setSignedIn(false);
  }, []);

  const sessionEnded = useCallback(() => {
    setAdminToken(null);
    setSignedIn(false);
    setError('Tu sesión de administración ha caducado. Entra de nuevo.');
  }, []);

  if (!signedIn) {
    return (
      <Screen onBack={leave}>
        <Text variant="display">Admin</Text>
        <TextField
          label="Contraseña de administración"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="off"
          returnKeyType="go"
          onSubmitEditing={() => void signIn()}
        />
        <Notice text={error} />
        <Button label={busy ? 'Entrando…' : 'Entrar'} onPress={() => void signIn()} disabled={busy} />
      </Screen>
    );
  }

  return (
    <Screen onBack={leave}>
      <Text variant="display">Admin</Text>
      <View style={styles.tabs}>
        <Button label="Usuarios" kind={tab === 'users' ? 'selected' : 'secondary'} onPress={() => setTab('users')} />
        <Button label="Claves IA" kind={tab === 'keys' ? 'selected' : 'secondary'} onPress={() => setTab('keys')} />
      </View>
      {tab === 'users' ? <UsersPanel onSessionEnded={sessionEnded} /> : <KeysPanel onSessionEnded={sessionEnded} />}
      <Button label="Salir del panel" kind="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({ tabs: { gap: space(1) } });
