import { zodResolver } from '@hookform/resolvers/zod';
import { sprint } from '@sana/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { projectKeys } from '@/entities/project';
import { api, applyProblemToForm, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

type Values = z.input<typeof sprint.CreateProjectInput>;

export function CreateProjectDialog({ teamId, onCreated, children }: { teamId: string; onCreated: (id: string) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(sprint.CreateProjectInput), defaultValues: { teamId, title: '', idea: '' } });
  const { errors } = form.formState;

  const create = useMutation({
    mutationFn: async (body: Values) => unwrap(await api.POST('/api/sprint/projects', { body: { ...body, teamId } })),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      setOpen(false);
      onCreated(project.id);
    },
    onError: (error) => {
      if (!applyProblemToForm(error, form.setError, ['title', 'idea'])) form.setError('root', { message: problemMessage(error) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
          <DialogDescription>Сроки этапов посчитаем от сегодняшнего дня — их сможет поправить ментор.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-4" noValidate>
          <Field label="Название" htmlFor="p-title" error={errors.title?.message}>
            <Input id="p-title" placeholder="Например, EcoCup" autoFocus {...form.register('title')} />
          </Field>
          <Field label="Идея" htmlFor="p-idea" error={errors.idea?.message} hint="Какую проблему решаете и для кого">
            <Textarea id="p-idea" rows={4} {...form.register('idea')} />
          </Field>
          <FormError message={errors.root?.message} />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Создаём…' : 'Создать проект'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
