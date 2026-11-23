import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthContext';
import { spacesApi } from '@/features/spaces/api';
import { cachedPeople, loadPeople } from '@/features/spaces/cache';
import { PeoplePicker } from '@/features/spaces/PeoplePicker';
import { pickedSummary } from '@/lib/spaces/people';
import { SPACE_NAME_MAX, spaceNameError } from '@/lib/spaces/validation';
import { space } from '@/theme/tokens';

/**
 * Create a space (only people the admin allowed; the server checks it) and tick
 * who joins it right away: they see it in their list without any code.
 */
export default function Crear() {
  const { token } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [people, setPeople] = useState(() => cachedPeople() ?? null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void loadPeople(token).then((res) => {
      if (res.ok) setPeople(res.data.people);
      else {
        setPeople((p) => p ?? []);
        setError(res.error);
      }
    });
  }, [token]);

  const create = async () => {
    const invalid = spaceNameError(name);
    if (invalid) return setError(invalid);
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const res = await spacesApi.create(token, name, [...picked]);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace(`/espacio/${res.data.space.space_id}`);
  };

  const names = (people ?? []).filter((p) => picked.has(p.user_id)).map((p) => p.username);
  return (
    <Screen
      narrow
      onBack={() => router.back()}
      footer={<Button label={busy ? 'Creando…' : 'Crear espacio'} onPress={() => void create()} disabled={busy} flex />}
    >
      <Text variant="display">Crear espacio</Text>
      <TextField
        label="Nombre del espacio"
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        maxLength={SPACE_NAME_MAX}
        returnKeyType="done"
      />
      <Notice text={error} />
      <View style={styles.block}>
        <PeoplePicker
          title="Con quién lo compartes"
          people={people}
          selected={picked}
          onChange={setPicked}
          footer="Las personas marcadas lo verán en su lista al momento, sin código. También recibes un código de 6 letras por si quieres invitar a alguien más."
        />
        {picked.size > 0 && <Text tone="secondary">{pickedSummary(picked.size, names)}</Text>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: space(2) } });
