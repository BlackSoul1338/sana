import { z } from 'zod';
import { Difficulty, Id, Timestamp } from './common.js';

export const FitComponents = z
  .object({
    skills: z.number().min(0).max(1),
    difficulty: z.number().min(0).max(1),
    time: z.number().min(0).max(1),
    interest: z.number().min(0).max(1),
  })
  .meta({ id: 'FitComponents' });

export const Fit = z
  .object({
    score: z.number().int().min(0).max(100),
    components: FitComponents,
    matched: z.array(z.object({ slug: z.string(), title: z.string(), required: z.boolean() })),
    gaps: z.array(z.object({ slug: z.string(), title: z.string(), required: z.boolean() })),
    reasons: z.array(z.string()).meta({ description: 'Объяснение соответствия для команды' }),
  })
  .meta({ id: 'Fit' });
export type Fit = z.infer<typeof Fit>;

export const Recommendation = z
  .object({
    taskId: Id,
    title: z.string(),
    orgName: z.string(),
    topic: z.string(),
    difficulty: Difficulty,
    estHours: z.number().int(),
    readiness: z.number().int(),
    fit: Fit,
  })
  .meta({ id: 'Recommendation' });

export const Growth = z
  .object({
    teamLevel: z.number().int(),
    skillsToAdd: z
      .array(z.object({ slug: z.string(), title: z.string(), unlocks: z.number().int() }))
      .meta({ description: 'Навыки, которых не хватает для более сложных задач, и сколько задач они откроют' }),
  })
  .meta({ id: 'Growth' });

export const RecommendationsResult = z
  .object({ teamId: Id, items: z.array(Recommendation), growth: Growth })
  .meta({ id: 'RecommendationsResult' });

export const RecommendationsQuery = z.object({
  teamId: Id,
  topic: z.string().optional(),
  difficulty: z.coerce.number().int().min(1).max(3).optional(),
  limit: z.coerce.number().int().min(5).max(30).default(5),
});

export const FitQuery = z.object({ teamId: Id });

export const ApplicationStatus = z.enum(['pending', 'accepted', 'declined', 'withdrawn']);

export const Application = z
  .object({
    id: Id,
    teamId: Id,
    teamName: z.string(),
    taskId: Id,
    taskTitle: z.string(),
    status: ApplicationStatus,
    score: z.number().int(),
    fit: Fit,
    message: z.string(),
    decisionComment: z.string().nullable(),
    createdAt: Timestamp,
    decidedAt: Timestamp.nullable(),
  })
  .meta({ id: 'Application' });

export const ApplyInput = z
  .object({ teamId: Id, taskId: Id, message: z.string().trim().max(2000).default('') })
  .meta({ id: 'ApplyInput' });

export const DecisionInput = z
  .object({ decision: z.enum(['accept', 'decline']), comment: z.string().trim().max(1000).default('') })
  .meta({ id: 'DecisionInput' });

export const ApplicationsQuery = z
  .object({ teamId: Id.optional(), taskId: Id.optional() })
  .refine((v) => !!v.teamId || !!v.taskId, 'Укажите teamId или taskId');

export const FeedbackInput = z
  .object({
    evidenceId: Id,
    verdict: z.enum(['positive', 'needs_work']),
    comment: z.string().trim().max(2000).default(''),
  })
  .meta({ id: 'FeedbackInput' });

export const FeedbackResult = z
  .object({ evidenceId: Id, verdict: z.enum(['positive', 'needs_work']), bonusPoints: z.number().int() })
  .meta({ id: 'FeedbackResult' });

export const DecisionResult = z
  .object({
    application: Application,
    assignmentId: Id.nullable().meta({ description: 'Для принятой заявки — закрепление задачи за командой' }),
    projectId: Id.nullable().meta({ description: 'Проект Startup Sprint, к которому привязана задача' }),
    projectCreated: z.boolean(),
  })
  .meta({ id: 'DecisionResult' });

export type Recommendation = z.infer<typeof Recommendation>;
export type RecommendationsResult = z.infer<typeof RecommendationsResult>;
export type Application = z.infer<typeof Application>;
export type Growth = z.infer<typeof Growth>;
export type DecisionResult = z.infer<typeof DecisionResult>;
export type FeedbackResult = z.infer<typeof FeedbackResult>;
