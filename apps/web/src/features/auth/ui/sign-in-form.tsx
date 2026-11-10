import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

const Schema = z.object({
  email: z.email('Похоже, в адресе опечатка'),
  password: z.string().min(1, 'Введите пароль'),
});
type Values = z.infer<typeof Schema>;

export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: { email: '', password: '' } });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      form.setError('root', {
        message: error.code === 'invalid_credentials' ? 'Неверная почта или пароль' : error.message,
      });
      return;
    }
    onSuccess();
  });

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="Почта" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" autoFocus {...form.register('email')} />
      </Field>
      <Field label="Пароль" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
      </Field>
      <FormError message={errors.root?.message} />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Входим…' : 'Войти'}
      </Button>
    </form>
  );
}
