import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { useAuth } from '@/features/auth/AuthContext';

/** Opened from the admin's invite link (…/activar?u=username), in the app on Android. */
export default function Activar() {
  const { activate } = useAuth();
  const router = useRouter();
  const { u } = useLocalSearchParams<{ u?: string }>();
  return (
    <AuthForm
      mode="activate"
      initialUsername={typeof u === 'string' ? u : ''}
      onSubmit={(username, password, code) => activate(username, code, password)}
      onSwitch={() => router.replace('/login')}
    />
  );
}
