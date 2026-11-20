import { useRouter } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { useAuth } from '@/features/auth/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  return <AuthForm mode="register" onSubmit={register} onSwitch={() => router.replace('/login')} />;
}
