import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthContext';
import { spacesApi } from '@/features/spaces/api';
import { SPACE_NAME_MAX, spaceNameError } from '@/lib/spaces/validation';
import { space } from '@/theme/tokens';

export default function Crear() {
  const { token } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const invalid = spaceNameError(name);
    if (invalid) return setError(invalid);
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const res = await spacesApi.create(token, name);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace(`/espacio/${res.data.space.space_id}`);
  };

  return (
    <Screen narrow onBack={() => router.back()}>
      <Text variant="display">Crear espacio</Text>
      <TextField
        label="Nombre del espacio"
        value={name}
        onChangeText={setName}
        autoCapitalize="sentences"
        maxLength={SPACE_NAME_MAX}
        returnKeyType="go"
        onSubmitEditing={() => void create()}
      />
      <Text tone="secondary">Al crearlo recibes un código de 6 letras y un enlace para invitar a tu grupo.</Text>
      <Notice text={error} />
      <View style={styles.block}>
        <Button label={busy ? 'Creando…' : 'Crear espacio'} onPress={() => void create()} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ block: { gap: space(2) } });
