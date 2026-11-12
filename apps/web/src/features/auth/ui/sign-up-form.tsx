import { zodResolver } from '@hookform/resolvers/zod';
import { SignUpInput } from '@sana/contracts';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { api, applyProblemToForm, problemMessage, supabase, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

type Values = z.input<typeof SignUpInput>;
type Output = z.output<typeof SignUpInput>;

/** The API creates a confirmed account (no e-mail round trip), then the form signs in with the same password. */
export function SignUpForm({ onSignedIn }: { onSignedIn: () => void }) {
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(SignUpInput), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      unwrap(await api.POST('/auth/sign-up', { body: values }));
    } catch (error) {
      if (!applyProblemToForm(error, form.setError, ['email', 'password'])) form.setError('root', { message: problemMessage(error) });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      form.setError('root', { message: 'Аккаунт создан, но войти не получилось — попробуйте на странице входа' });
      return;
    }
    onSignedIn();
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="Почта" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" autoFocus {...form.register('email')} />
      </Field>
      <Field label="Пароль" htmlFor="password" error={errors.password?.message} hint="Минимум 8 символов">
        <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
      </Field>
      <FormError message={errors.root?.message} />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Создаём…' : 'Создать аккаунт'}
      </Button>
    </form>
  );
}
