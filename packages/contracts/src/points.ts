import { z } from 'zod';
import { Id, Timestamp } from './common.js';

export const SubjectType = z.enum(['team', 'profile', 'org']);
export type SubjectType = z.infer<typeof SubjectType>;

export const PointEvent = z
  .object({
    id: Id,
    subjectType: SubjectType,
    subjectId: Id,
    module: z.string(),
    ruleId: z.string(),
    points: z.number().int(),
    explanation: z.string().meta({ description: 'Человекочитаемое объяснение начисления' }),
    evidenceId: Id.nullable(),
    actorId: Id.nullable(),
    createdAt: Timestamp,
  })
  .meta({ id: 'PointEvent' });
export type PointEvent = z.infer<typeof PointEvent>;

export const LeaderboardEntry = z
  .object({
    subjectType: SubjectType,
    subjectId: Id,
    name: z.string(),
    total: z.number().int(),
    rank: z.number().int(),
  })
  .meta({ id: 'LeaderboardEntry' });
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const LeaderboardQuery = z.object({
  subjectType: SubjectType.default('team'),
  module: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PointsQuery = z.object({ subjectType: SubjectType, subjectId: Id });

export const AdjustmentInput = z
  .object({
    subjectType: SubjectType,
    subjectId: Id,
    module: z.string().min(1),
    points: z.number().int().min(-200).max(200).refine((v) => v !== 0, 'Поправка не может быть нулевой'),
    comment: z.string().trim().min(5).max(1000),
  })
  .meta({ id: 'AdjustmentInput' });
