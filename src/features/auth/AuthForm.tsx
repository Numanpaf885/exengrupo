import { useRef, useState } from 'react';
import { StyleSheet, type TextInputInstance, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { passwordError, usernameError } from '@/lib/auth/validation';
import { space } from '@/theme/tokens';

interface Props {
  mode: 'login' | 'register';
  onSubmit(username: string, password: string): Promise<string | null>;
  onSwitch(): void;
}

/** Shared Swiss login / register form. All text in Spanish. */
export function AuthForm({ mode, onSubmit, onSwitch }: Props) {
  const isRegister = mode === 'register';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const repeatRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (busy) return;
    const local = isRegister
      ? (usernameError(username) ??
        passwordError(password) ??
        (password !== repeat ? 'Las contraseñas no coinciden.' : null))
      : !username.trim() || !password
        ? 'Escribe tu usuario y tu contraseña.'
        : null;
    if (local) {
      setError(local);
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSubmit(username, password);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <Screen>
      <Text variant="display">exengrupo</Text>
      <Text variant="title">{isRegister ? 'Crear cuenta' : 'Entrar'}</Text>
      <View style={styles.fields}>
        <TextField
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          maxLength={20}
        />
        <TextField
          ref={passwordRef}
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          textContentType={isRegister ? 'newPassword' : 'password'}
          returnKeyType={isRegister ? 'next' : 'go'}
          onSubmitEditing={() => (isRegister ? repeatRef.current?.focus() : void submit())}
        />
        {isRegister && (
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
      {isRegister && <Text>Usuario: 3 a 20 letras, números, punto o guion. Contraseña: mínimo 8 caracteres.</Text>}
      {error && (
        <Text variant="label" accessibilityRole="alert">
          {error}
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          label={busy ? (isRegister ? 'Creando…' : 'Entrando…') : isRegister ? 'Crear cuenta' : 'Entrar'}
          onPress={() => void submit()}
          disabled={busy}
        />
        <Button
          label={isRegister ? 'Ya tengo cuenta' : 'Crear cuenta'}
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
