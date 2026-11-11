import { zodResolver } from '@hookform/resolvers/zod';
import { ReviewInput } from '@sana/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { evidenceKeys } from '@/entities/evidence';
import { projectKeys } from '@/entities/project';
import { api, applyProblemToForm, problemMessage, unwrap } from '@/shared/api';
import { RULE_TITLES } from '@/shared/config';
import { signed } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';
import { Textarea } from '@/shared/ui/textarea';

type Input_ = z.input<typeof ReviewInput>;
type Output = z.output<typeof ReviewInput>;

export function ReviewForm({ evidenceId, onDone }: { evidenceId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<Input_, unknown, Output>({
    resolver: zodResolver(ReviewInput),
    defaultValues: { decision: 'approve', comment: '' },
  });
  const decision = useWatch({ control: form.control, name: 'decision' });
  const { errors } = form.formState;

  const review = useMutation({
    mutationFn: async (body: Output) =>
      unwrap(await api.POST('/api/evidence/{id}/review', { params: { path: { id: evidenceId } }, body })),
    onSuccess: async (result) => {
      const total = result.awarded.reduce((s, e) => s + e.points, 0);
      const lines = result.awarded.map((e) => `${RULE_TITLES[e.ruleId] ?? 'Начисление'}: ${signed(e.points)}`).join('\n');
      if (result.evidence.status === 'rejected') toast('Отправлено на доработку');
      else toast.success(total ? `Начислено ${signed(total)}` : 'Подтверждено', { description: lines || undefined });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: evidenceKeys.all }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
      ]);
      onDone();
    },
    onError: (error) => {
      if (!applyProblemToForm(error, form.setError, ['comment', 'adjustPoints'])) form.setError('root', { message: problemMessage(error) });
    },
  });

  return (
    <form onSubmit={form.handleSubmit((v) => review.mutate(v))} className="grid gap-4" noValidate>
      <Controller
        control={form.control}
        name="decision"
        render={({ field }) => (
          <Segmented
            label="Решение"
            value={field.value}
            onChange={(v) => {
              field.onChange(v);
              if (v !== 'adjust') form.setValue('adjustPoints', undefined);
            }}
            className="self-start"
            options={[
              { value: 'approve', label: 'Принять' },
              { value: 'adjust', label: 'С поправкой' },
              { value: 'reject', label: 'На доработку' },
            ]}
          />
        )}
      />
      {decision === 'adjust' && (
        <Field label="Поправка к баллам команды" htmlFor="adj" error={errors.adjustPoints?.message} hint="От −200 до 200, добавится к начислению по правилам">
          <Input id="adj" type="number" className="w-28" {...form.register('adjustPoints', { setValueAs: (v: string) => (v === '' ? undefined : Number(v)) })} />
        </Field>
      )}
      <Field
        label={decision === 'approve' ? 'Комментарий (по желанию)' : 'Комментарий для команды'}
        htmlFor="rv-comment"
        error={errors.comment?.message}
      >
        <Textarea
          id="rv-comment"
          rows={3}
          placeholder={decision === 'reject' ? 'Что доработать, чтобы принять' : undefined}
          {...form.register('comment')}
        />
      </Field>
      <FormError message={errors.root?.message} />
      <Button type="submit" variant={decision === 'reject' ? 'outline' : 'default'} disabled={review.isPending} className="w-fit">
        {review.isPending
          ? 'Сохраняем решение…'
          : decision === 'approve'
            ? 'Принять'
            : decision === 'adjust'
              ? 'Принять с поправкой'
              : 'Вернуть на доработку'}
      </Button>
    </form>
  );
}
