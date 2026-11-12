import { Link, useRouter } from '@tanstack/react-router';
import { SignInForm } from '@/features/auth';
import { AuthLayout } from './auth-layout';

export function SignInPage() {
  const router = useRouter();
  return (
    <AuthLayout
      title="С возвращением"
      subtitle="Войдите, чтобы продолжить работу"
      pitch
      footer={
        <>
          Впервые здесь?{' '}
          <Link to="/sign-up" className="text-foreground font-medium underline-offset-4 hover:underline">
            Создать аккаунт
          </Link>
        </>
      }
    >
      <SignInForm onSuccess={() => void router.navigate({ to: '/' })} />
    </AuthLayout>
  );
}
