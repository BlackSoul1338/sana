import { zodResolver } from '@hookform/resolvers/zod';
import { CreateProfileInput } from '@sana/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, GraduationCap } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { meQuery } from '@/entities/viewer';
import { api, applyProblemToForm, problemMessage, unwrap } from '@/shared/api';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

type Values = z.input<typeof CreateProfileInput>;

const ROLES = [
  { value: 'student', icon: GraduationCap, title: 'Я студент', text: 'Команда, стартап, практика и исследования' },
  { value: 'business', icon: Briefcase, title: 'Я из бизнеса', text: 'Ставлю задачи для студенческих команд' },
] as const;

export function CreateProfileForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(CreateProfileInput),
    defaultValues: { displayName: '', role: 'student', orgName: '' },
  });
  const role = useWatch({ control: form.control, name: 'role' });
  const { errors } = form.formState;

  const create = useMutation({
    mutationFn: async (body: Values) =>
      unwrap(
        await api.POST('/api/me/profile', {
          body: { ...body, orgName: body.role === 'business' ? body.orgName : undefined },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      onCreated();
    },
    onError: (error) => {
      if (!applyProblemToForm(error, form.setError, ['displayName', 'role', 'orgName'])) {
        form.setError('root', { message: problemMessage(error) });
      }
    },
  });

  return (
    <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-6" noValidate>
      <div role="radiogroup" aria-label="Роль" className="grid gap-3 sm:grid-cols-2">
        {ROLES.map(({ value, icon: Icon, title, text }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            onClick={() => form.setValue('role', value)}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              role === value ? 'border-primary bg-accent' : 'hover:bg-muted',
            )}
          >
            <Icon className={cn('mb-3 size-5', role === value ? 'text-primary' : 'text-muted-foreground')} />
            <div className="font-medium">{title}</div>
            <div className="text-muted-foreground text-sm">{text}</div>
          </button>
        ))}
      </div>
      <Field label="Как вас называть" htmlFor="displayName" error={errors.displayName?.message}>
        <Input id="displayName" autoFocus {...form.register('displayName')} />
      </Field>
      {role === 'business' && (
        <Field label="Компания" htmlFor="orgName" error={errors.orgName?.message}>
          <Input id="orgName" {...form.register('orgName')} />
        </Field>
      )}
      <FormError message={errors.root?.message} />
      <Button type="submit" size="lg" disabled={create.isPending}>
        {create.isPending ? 'Сохраняем…' : 'Продолжить'}
      </Button>
    </form>
  );
}
