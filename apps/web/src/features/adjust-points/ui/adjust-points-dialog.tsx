import { zodResolver } from '@hookform/resolvers/zod';
import { AdjustmentInput } from '@sana/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { projectKeys } from '@/entities/project';
import { api, applyProblemToForm, problemMessage, unwrap } from '@/shared/api';
import { signed } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

type Values = z.input<typeof AdjustmentInput>;

export function AdjustPointsDialog({ teamId, teamName, children }: { teamId: string; teamName: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(AdjustmentInput),
    defaultValues: { subjectType: 'team', subjectId: teamId, module: 'sprint', points: 0, comment: '' },
  });
  const { errors } = form.formState;

  const adjust = useMutation({
    mutationFn: async (body: Values) => unwrap(await api.POST('/api/points/adjustments', { body })),
    onSuccess: async (e) => {
      toast.success(`${signed(e.points)} команде «${teamName}»`);
      setOpen(false);
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
      ]);
    },
    onError: (error) => {
      if (!applyProblemToForm(error, form.setError, ['points', 'comment'])) form.setError('root', { message: problemMessage(error) });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Поправка баллов</DialogTitle>
          <DialogDescription>Запишется отдельным событием с вашим объяснением — команда его увидит.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => adjust.mutate(v))} className="grid gap-4" noValidate>
          <Field label="Баллы" htmlFor="pts" error={errors.points?.message} hint="От −200 до 200">
            <Input id="pts" type="number" className="w-28" {...form.register('points', { valueAsNumber: true })} />
          </Field>
          <Field label="Почему" htmlFor="pts-comment" error={errors.comment?.message}>
            <Textarea id="pts-comment" rows={3} {...form.register('comment')} />
          </Field>
          <FormError message={errors.root?.message} />
          <DialogFooter>
            <Button type="submit" disabled={adjust.isPending}>
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
