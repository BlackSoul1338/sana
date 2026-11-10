import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { projectKeys, type Project } from '@/entities/project';
import { ApiProblem, applyProblemToForm, problemMessage } from '@/shared/api';
import { STAGE_TITLES } from '@/shared/config';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { submitEvidence } from '../api/submit';
import { EvidenceFormSchema, FILE_TYPES, type EvidenceFormInput, type EvidenceFormValues } from '../model/schema';

type Target = EvidenceFormInput['target'];

export function SubmitEvidenceDialog({
  project,
  defaultTarget = 'stage',
  defaultTaskId,
  children,
}: {
  project: Project;
  defaultTarget?: Target;
  defaultTaskId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const current = project.stages.find((s) => s.isCurrent);
  const openTasks = project.tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');

  const form = useForm<EvidenceFormInput, unknown, EvidenceFormValues>({
    resolver: zodResolver(EvidenceFormSchema),
    defaultValues: {
      target: defaultTarget,
      stageKey: current?.key,
      taskId: defaultTaskId,
      kind: defaultTarget === 'interview' ? 'interview' : 'link',
      url: '',
      file: null,
      note: '',
    },
  });
  const target = useWatch({ control: form.control, name: 'target' });
  const { errors } = form.formState;

  const submit = useMutation({
    // The current stage can move while the dialog stays mounted, so read it at submit time.
    mutationFn: (v: EvidenceFormValues) => submitEvidence(project.id, { ...v, stageKey: current?.key }),
    onSuccess: async () => {
      toast.success('Отправлено ментору на проверку');
      setOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    },
    onError: (error) => {
      if (error instanceof ApiProblem && error.problem.details?.currentStage) {
        form.setError('root', { message: error.message });
        return;
      }
      if (!applyProblemToForm(error, form.setError, ['target', 'taskId', 'url', 'note', 'storagePath'])) {
        form.setError('root', { message: problemMessage(error) });
      }
    },
  });

  const canCloseStage = !!current && current.status !== 'submitted';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Подтвердить прогресс</DialogTitle>
          <DialogDescription>Ментор проверит и начислит баллы. Без подтверждения баллов нет.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => submit.mutate(v))} className="grid gap-5" noValidate>
          <Controller
            control={form.control}
            name="target"
            render={({ field }) => (
              <Segmented
                label="Что подтверждаем"
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  form.setValue('kind', v === 'interview' ? 'interview' : 'link');
                }}
                options={[
                  { value: 'stage', label: 'Этап', disabled: !canCloseStage },
                  { value: 'interview', label: 'Интервью' },
                  { value: 'task', label: 'Задачу', disabled: openTasks.length === 0 },
                ]}
              />
            )}
          />
          {target === 'stage' && current && (
            <p className="text-sm">
              Закрываем этап <span className="font-medium">«{STAGE_TITLES[current.key]}»</span>
            </p>
          )}
          {errors.target && <p className="text-destructive text-sm">{errors.target.message}</p>}
          {target === 'task' && (
            <Field label="Задача" error={errors.taskId?.message}>
              <Controller
                control={form.control}
                name="taskId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите задачу" />
                    </SelectTrigger>
                    <SelectContent>
                      {openTasks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          {target !== 'interview' && (
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Segmented
                  label="Тип подтверждения"
                  value={field.value}
                  onChange={field.onChange}
                  className="self-start"
                  options={[
                    { value: 'link', label: 'Ссылка' },
                    { value: 'screenshot', label: 'Скриншот' },
                    { value: 'report', label: 'Отчёт' },
                  ]}
                />
              )}
            />
          )}
          <Field label="Ссылка" htmlFor="ev-url" error={errors.url?.message}>
            <Input id="ev-url" placeholder="https://" {...form.register('url')} />
          </Field>
          <Controller
            control={form.control}
            name="file"
            render={({ field }) => (
              <Field label="Файл" error={errors.file?.message} hint="PNG, JPG, WEBP или PDF до 10 МБ">
                {field.value ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <Paperclip className="text-muted-foreground size-4" />
                    <span className="truncate">{field.value.name}</span>
                    <Button type="button" variant="ghost" size="icon-xs" className="ml-auto" aria-label="Убрать файл" onClick={() => field.onChange(null)}>
                      <X />
                    </Button>
                  </div>
                ) : (
                  <label className="text-muted-foreground hover:border-ring/60 hover:text-foreground flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm transition-colors focus-within:ring-[3px] focus-within:ring-ring/50">
                    <Paperclip className="size-4" />
                    Прикрепить файл
                    <input
                      type="file"
                      className="sr-only"
                      accept={FILE_TYPES.join(',')}
                      onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </Field>
            )}
          />
          <Field
            label={target === 'interview' ? 'С кем говорили и что узнали' : 'Комментарий'}
            htmlFor="ev-note"
            error={errors.note?.message}
          >
            <Textarea id="ev-note" rows={3} {...form.register('note')} />
          </Field>
          <FormError message={errors.root?.message} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? 'Отправляем…' : 'Отправить на проверку'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
