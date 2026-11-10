import { Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { SignUpForm } from '@/features/auth';
import { AuthLayout } from './auth-layout';

export function SignUpPage() {
  const router = useRouter();
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <AuthLayout title="Проверьте почту" subtitle="Мы отправили ссылку для подтверждения. После неё можно войти.">
        <Link to="/sign-in" className="text-primary font-medium">
          Перейти ко входу →
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Давайте знакомиться"
      subtitle="Аккаунт для студентов и компаний"
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/sign-in" className="text-foreground font-medium underline-offset-4 hover:underline">
            Войти
          </Link>
        </>
      }
    >
      <SignUpForm onSignedIn={() => void router.navigate({ to: '/onboarding' })} onNeedsConfirm={() => setSent(true)} />
    </AuthLayout>
  );
}
