import { z } from 'zod';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const;

/** Mirrors SubmitSprintEvidenceInput, plus a local file that is uploaded before submit. */
export const EvidenceFormSchema = z
  .object({
    target: z.enum(['stage', 'task', 'interview']),
    stageKey: z.string().optional(),
    taskId: z.string().optional(),
    kind: z.enum(['link', 'screenshot', 'interview', 'report']),
    url: z.union([z.literal(''), z.url('Нужна ссылка вида https://…')]).default(''),
    file: z
      .instanceof(File)
      .nullable()
      .default(null)
      .refine((f) => !f || f.size <= MAX_FILE_BYTES, 'Файл больше 10 МБ')
      .refine((f) => !f || (FILE_TYPES as readonly string[]).includes(f.type), 'Подойдут PNG, JPG, WEBP или PDF'),
    note: z.string().trim().max(4000).default(''),
  })
  .refine((v) => v.target !== 'stage' || !!v.stageKey, { path: ['target'], message: 'Нет текущего этапа' })
  .refine((v) => v.target !== 'task' || !!v.taskId, { path: ['taskId'], message: 'Выберите задачу' })
  .refine((v) => !!v.url || !!v.file || v.note.length >= 20, {
    path: ['note'],
    message: 'Приложите ссылку или файл — или опишите результат хотя бы в 20 символах',
  });

export type EvidenceFormInput = z.input<typeof EvidenceFormSchema>;
export type EvidenceFormValues = z.output<typeof EvidenceFormSchema>;
