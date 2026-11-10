import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTeamInput } from '@sana/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { meQuery } from '@/entities/viewer';
import { api, applyProblemToForm, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

type Values = z.input<typeof CreateTeamInput>;
type Output = z.output<typeof CreateTeamInput>;

export function CreateTeamForm({ onCreated }: { onCreated: (teamId: string) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(CreateTeamInput), defaultValues: { name: '', weeklyHours: 10, interests: [] } });
  const { errors } = form.formState;

  const create = useMutation({
    mutationFn: async (body: Output) => unwrap(await api.POST('/api/teams', { body })),
    onSuccess: async (team) => {
      await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      onCreated(team.id);
    },
    onError: (error) => {
      if (!applyProblemToForm(error, form.setError, ['name', 'weeklyHours'])) form.setError('root', { message: problemMessage(error) });
    },
  });

  return (
    <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid max-w-md gap-4" noValidate>
      <Field label="Название команды" htmlFor="t-name" error={errors.name?.message}>
        <Input id="t-name" autoFocus {...form.register('name')} />
      </Field>
      <Field label="Часов в неделю на всю команду" htmlFor="t-hours" error={errors.weeklyHours?.message} hint="Поможет подобрать задачи по силам">
        <Input id="t-hours" type="number" min={1} max={80} className="w-28" {...form.register('weeklyHours', { valueAsNumber: true })} />
      </Field>
      <FormError message={errors.root?.message} />
      <Button type="submit" className="w-fit" disabled={create.isPending}>
        Создать команду
      </Button>
    </form>
  );
}
