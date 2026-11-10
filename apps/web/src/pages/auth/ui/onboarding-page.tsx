import { useRouter } from '@tanstack/react-router';
import { CreateProfileForm } from '@/features/create-profile';
import { AuthLayout } from './auth-layout';

export function OnboardingPage() {
  const router = useRouter();
  return (
    <AuthLayout title="Кто вы на платформе?" subtitle="Это определит, что вы увидите дальше. Менторов добавляют организаторы.">
      <CreateProfileForm onCreated={() => void router.navigate({ to: '/' })} />
    </AuthLayout>
  );
}
