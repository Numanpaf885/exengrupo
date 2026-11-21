import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/features/auth/AuthContext';
import { spacesApi } from '@/features/spaces/api';

export default function UnirseConCodigo() {
  const { token } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    if (code.replace(/[^a-z]/gi, '').length !== 6) return setError('El código tiene 6 letras. Revísalo.');
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const res = await spacesApi.join(token, code);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.replace(`/espacio/${res.data.space.space_id}`);
  };

  return (
    <Screen onBack={() => router.back()}>
      <Text variant="display">Unirme</Text>
      <TextField
        label="Código del espacio"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        maxLength={7}
        returnKeyType="go"
        onSubmitEditing={() => void join()}
      />
      <Text>Pide el código de 6 letras a quien creó el espacio.</Text>
      <Notice text={error} />
      <Button label={busy ? 'Uniéndome…' : 'Unirme'} onPress={() => void join()} disabled={busy} />
    </Screen>
  );
}
