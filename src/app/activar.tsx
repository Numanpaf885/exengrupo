import { useRouter } from 'expo-router';
import { AuthForm } from '@/features/auth/AuthForm';
import { useAuth } from '@/features/auth/AuthContext';

export default function Activar() {
  const { activate } = useAuth();
  const router = useRouter();
  return <AuthForm mode="activate" onSubmit={(u, p, c) => activate(u, c, p)} onSwitch={() => router.replace('/login')} />;
}
