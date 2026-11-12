import { Link, useRouter } from '@tanstack/react-router';
import { SignUpForm } from '@/features/auth';
import { AuthLayout } from './auth-layout';

export function SignUpPage() {
  const router = useRouter();
  return (
    <AuthLayout
      title="Давайте знакомиться"
      subtitle="Аккаунт для студентов и компаний"
      pitch
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/sign-in" className="text-foreground font-medium underline-offset-4 hover:underline">
            Войти
          </Link>
        </>
      }
    >
      <SignUpForm onSignedIn={() => void router.navigate({ to: '/onboarding' })} />
    </AuthLayout>
  );
}
