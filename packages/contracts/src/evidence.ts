import { z } from 'zod';
import { Id, Role, Timestamp } from './common.js';
import { PointEvent } from './points.js';

export const EvidenceKind = z.enum(['link', 'screenshot', 'interview', 'report']);
export const EvidenceStatus = z.enum(['pending', 'approved', 'rejected', 'adjusted']);

export const Evidence = z
  .object({
    id: Id,
    module: z.string(),
    subjectType: z.string(),
    subjectId: Id,
    teamId: Id.nullable(),
    submittedBy: Id,
    kind: EvidenceKind,
    url: z.string().nullable(),
    storagePath: z.string().nullable(),
    note: z.string(),
    reviewerRole: Role,
    status: EvidenceStatus,
    reviewedBy: Id.nullable(),
    reviewComment: z.string().nullable(),
    reviewedAt: Timestamp.nullable(),
    createdAt: Timestamp,
  })
  .meta({ id: 'Evidence' });
export type Evidence = z.infer<typeof Evidence>;

export const ReviewInput = z
  .object({
    decision: z.enum(['approve', 'reject', 'adjust']),
    comment: z.string().trim().max(1000).default(''),
    adjustPoints: z
      .number()
      .int()
      .min(-200)
      .max(200)
      .optional()
      .meta({ description: 'Только для adjust: поправка с обязательным комментарием — команде, а работе без команды — её автору' }),
  })
  .refine((v) => v.decision !== 'adjust' || (v.adjustPoints !== undefined && v.comment.length >= 5), {
    path: ['comment'],
    message: 'Для корректировки нужны adjustPoints и комментарий',
  })
  .refine((v) => v.decision !== 'reject' || v.comment.length >= 5, {
    path: ['comment'],
    message: 'Отклонение требует комментария',
  })
  .meta({ id: 'ReviewInput' });

export const UploadUrlInput = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    contentType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  })
  .meta({ id: 'UploadUrlInput' });

export const UploadUrl = z
  .object({ storagePath: z.string(), signedUrl: z.string(), token: z.string() })
  .meta({ id: 'UploadUrl' });

export const EvidenceQueueQuery = z.object({
  status: EvidenceStatus.default('pending').meta({ description: 'approved includes adjusted (accepted with an adjustment)' }),
  module: z.string().optional(),
  teamId: Id.optional(),
});

export const EvidenceQueueItem = Evidence.extend({ submitterName: z.string() }).meta({ id: 'EvidenceQueueItem' });

export const EvidenceDetail = Evidence.extend({
  downloadUrl: z.string().nullable().meta({ description: 'Временная ссылка на файл (если он загружен)' }),
}).meta({ id: 'EvidenceDetail' });

export const ReviewResult = z
  .object({
    evidence: Evidence,
    awarded: z.array(PointEvent).meta({ description: 'Все начисления, связанные с этим подтверждением' }),
  })
  .meta({ id: 'ReviewResult' });
