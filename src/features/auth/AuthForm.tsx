import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { Button } from '@/components/Button';
import { FadeIn } from '@/components/FadeIn';
import { HiddenAdminTitle } from '@/components/HiddenAdminTitle';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { passwordError } from '@/lib/auth/validation';
import { space } from '@/theme/tokens';

interface Props {
  mode: 'login' | 'activate';
  /** Returns a Spanish error message, or null on success. `code` is only sent when activating. */
  onSubmit(username: string, password: string, code: string): Promise<string | null>;
  onSwitch(): void;
  /** Pre-filled from the invite link (?u=). */
  initialUsername?: string;
}

/** Swiss sign-in / account activation (one-time code from the admin). All text in Spanish. */
export function AuthForm({ mode, onSubmit, onSwitch, initialUsername = '' }: Props) {
  const activating = mode === 'activate';
  const [username, setUsername] = useState(initialUsername);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const repeatRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (busy) return;
    const local = !username.trim()
      ? 'Escribe tu usuario.'
      : activating
        ? code.replace(/[\s-]/g, '').length !== 12
          ? 'El código tiene 12 caracteres (XXXX-XXXX-XXXX).'
          : (passwordError(password) ?? (password !== repeat ? 'Las contraseñas no coinciden.' : null))
        : !password
          ? 'Escribe tu contraseña.'
          : null;
    if (local) {
      setError(local);
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSubmit(username, password, code);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <Screen narrow>
      <HiddenAdminTitle />
      <Text variant="title">{activating ? 'Activar cuenta' : 'Entrar'}</Text>
      {activating && <Text tone="secondary">Escribe tu usuario y el código de un solo uso que te dio el administrador, y elige tu contraseña.</Text>}
      <View style={styles.fields}>
        <TextField
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => (activating ? codeRef.current?.focus() : passwordRef.current?.focus())}
          maxLength={20}
        />
        {activating && (
          <TextField
            ref={codeRef}
            label="Código de un solo uso (XXXX-XXXX-XXXX)"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={16}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        )}
        <TextField
          ref={passwordRef}
          label={activating ? 'Nueva contraseña' : 'Contraseña'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={activating ? 'new-password' : 'current-password'}
          textContentType={activating ? 'newPassword' : 'password'}
          returnKeyType={activating ? 'next' : 'go'}
          onSubmitEditing={() => (activating ? repeatRef.current?.focus() : void submit())}
        />
        {activating && (
          <TextField
            ref={repeatRef}
            label="Repite la contraseña"
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />
        )}
      </View>
      {activating && <Text tone="secondary">La contraseña necesita al menos 8 caracteres. El código caduca a las 72 horas.</Text>}
      {error && (
        <FadeIn key={error} offset={8}>
          <Text variant="label" accessibilityRole="alert">
            {error}
          </Text>
        </FadeIn>
      )}
      <View style={styles.actions}>
        <Button
          label={busy ? (activating ? 'Activando…' : 'Entrando…') : activating ? 'Activar cuenta' : 'Entrar'}
          onPress={() => void submit()}
          disabled={busy}
        />
        <Button
          label={activating ? 'Ya tengo contraseña' : 'Tengo un código'}
          kind="secondary"
          onPress={onSwitch}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space(3) },
  actions: { gap: space(2) },
});
