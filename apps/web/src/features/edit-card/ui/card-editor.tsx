import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { forwardRef, useImperativeHandle } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { draftKeys, type Draft } from '@/entities/draft';
import { ApiProblem, api, applyProblemToForm, problemMessage, unwrap } from '@/shared/api';
import { CARD_FIELD_ORDER, CARD_FIELDS, DIFFICULTY } from '@/shared/config';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';
import { Textarea } from '@/shared/ui/textarea';
import { SkillsPicker } from './skills-picker';

const CardFieldSchema = z.object({ text: z.string().trim().min(1, 'Заполните или напишите «не указано»'), source: z.enum(['dialog', 'not_specified']) });
const Schema = z.object({
  card: z.object(Object.fromEntries(CARD_FIELD_ORDER.map((k) => [k, CardFieldSchema])) as Record<(typeof CARD_FIELD_ORDER)[number], typeof CardFieldSchema>),
  summary: z.string().trim().min(5, 'Минимум 5 символов').max(600),
  requirements: z.object({
    topic: z.string().trim().min(2, 'Укажите тему').max(60),
    difficulty: z.number().int().min(1).max(3),
    estHours: z.number({ error: 'Сколько часов' }).int().min(4, 'От 4 часов').max(400, 'До 400 часов'),
    skills: z.array(z.object({ slug: z.string(), required: z.boolean() })).min(1, 'Добавьте хотя бы один навык — по ним подбираются команды').max(12),
  }),
});
type Values = z.infer<typeof Schema>;

export type CardEditorHandle = { saveIfDirty: () => Promise<boolean> };

export const CardEditor = forwardRef<CardEditorHandle, { draft: Draft; warnings: string[] }>(function CardEditor({ draft, warnings }, ref) {
  const queryClient = useQueryClient();
  const form = useForm<Values, unknown, Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      card: draft.card!,
      summary: draft.summary ?? '',
      requirements: draft.requirements ?? { topic: '', difficulty: 2, estHours: 40, skills: [] },
    },
  });
  const { errors, isDirty } = form.formState;

  const save = useMutation({
    mutationFn: async (body: Values) =>
      unwrap(await api.PATCH('/api/bcb/drafts/{id}/card', { params: { path: { id: draft.id } }, body })),
    onSuccess: (d) => {
      queryClient.setQueryData(draftKeys.detail(draft.id), d);
      form.reset(form.getValues());
    },
    onError: (error) => {
      if (error instanceof ApiProblem && error.code === 'sensitive_data') {
        form.setError('root', { message: 'В карточке есть персональные данные (почта, телефон, ИИН или карта) — уберите их' });
      } else if (!applyProblemToForm(error, form.setError, ['summary', 'requirements.skills', 'requirements'])) {
        form.setError('root', { message: problemMessage(error) });
      }
    },
  });

  useImperativeHandle(ref, () => ({
    saveIfDirty: async () => {
      if (!form.formState.isDirty) return form.trigger();
      let ok = false;
      await form.handleSubmit(async (v) => {
        await save.mutateAsync(v).then(() => (ok = true), () => (ok = false));
      })();
      return ok;
    },
  }));

  return (
    <form
      onSubmit={form.handleSubmit((v) => save.mutate(v, { onSuccess: () => toast.success('Сохранено') }))}
      className="grid gap-10"
      noValidate
    >
      {warnings.length > 0 && (
        <ul className="bg-warning-soft grid gap-1 rounded-lg p-4 text-sm">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <section className="grid gap-5">
        {CARD_FIELD_ORDER.map((key) => (
          <Controller
            key={key}
            control={form.control}
            name={`card.${key}`}
            render={({ field }) => (
              <Field
                label={
                  <>
                    {CARD_FIELDS[key].label}
                    {field.value.source === 'not_specified' && <span className="text-warning ml-2">не указано в диалоге</span>}
                  </>
                }
                error={errors.card?.[key]?.text?.message}
              >
                <Textarea
                  rows={key === 'title' ? 1 : 3}
                  value={field.value.text}
                  onChange={(e) => field.onChange({ text: e.target.value, source: 'dialog' })}
                  className={key === 'title' ? 'min-h-0 text-lg font-medium' : undefined}
                />
              </Field>
            )}
          />
        ))}
        <Field label="Кратко для каталога" htmlFor="summary" error={errors.summary?.message}>
          <Textarea id="summary" rows={2} {...form.register('summary')} />
        </Field>
      </section>

      <section className="grid gap-5">
        <h3 className="font-semibold">Требования к команде</h3>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto_auto]">
          <Field label="Тема" htmlFor="topic" error={errors.requirements?.topic?.message}>
            <Input id="topic" {...form.register('requirements.topic')} />
          </Field>
          <Field label="Сложность">
            <Controller
              control={form.control}
              name="requirements.difficulty"
              render={({ field }) => (
                <Segmented
                  label="Сложность"
                  value={String(field.value) as '1' | '2' | '3'}
                  onChange={(v) => field.onChange(Number(v))}
                  options={([1, 2, 3] as const).map((d) => ({ value: String(d) as '1' | '2' | '3', label: DIFFICULTY[d] }))}
                />
              )}
            />
          </Field>
          <Field label="Часов на проект" htmlFor="hours" error={errors.requirements?.estHours?.message}>
            <Input id="hours" type="number" className="w-28" {...form.register('requirements.estHours', { valueAsNumber: true })} />
          </Field>
        </div>
        <Field label="Навыки" error={errors.requirements?.skills?.message ?? errors.requirements?.skills?.root?.message}>
          <Controller control={form.control} name="requirements.skills" render={({ field }) => <SkillsPicker value={field.value} onChange={field.onChange} />} />
        </Field>
      </section>

      <FormError message={errors.root?.message} />
      <div>
        <Button type="submit" variant="outline" disabled={!isDirty || save.isPending}>
          {save.isPending ? 'Сохраняем…' : isDirty ? 'Сохранить изменения' : 'Сохранено'}
        </Button>
      </div>
    </form>
  );
});
