import { useRouter } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { useAuth } from '@/features/auth/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  return <AuthForm mode="login" onSubmit={login} onSwitch={() => router.replace('/register')} />;
}
