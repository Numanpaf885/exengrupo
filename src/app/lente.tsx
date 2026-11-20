import { useRouter } from 'expo-router';
import { LensTestScreen } from '@/features/lens/LensTestScreen';

export default function Lente() {
  const router = useRouter();
  return <LensTestScreen onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
