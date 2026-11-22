import { useRouter } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { useAuth } from '@/features/auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  return <AuthForm mode="login" onSubmit={(u, p) => login(u, p)} onSwitch={() => router.replace('/activar')} />;
}
