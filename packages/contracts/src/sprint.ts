import { z } from 'zod';
import { DateOnly, Id, Timestamp } from './common.js';
import { Evidence, EvidenceKind } from './evidence.js';

export const StageKey = z.enum(['idea', 'problem', 'interviews', 'prototype', 'testing']);
export type StageKey = z.infer<typeof StageKey>;

export const StageStatus = z.enum(['open', 'submitted', 'approved', 'rejected']);
export const SprintTaskStatus = z.enum(['todo', 'in_progress', 'submitted', 'done']);

export const Stage = z
  .object({
    key: StageKey,
    order: z.number().int(),
    status: StageStatus,
    plannedAt: DateOnly,
    completedAt: Timestamp.nullable(),
    isCurrent: z.boolean(),
  })
  .meta({ id: 'SprintStage' });

export const SprintTask = z
  .object({
    id: Id,
    projectId: Id,
    templateSlug: z.string().nullable(),
    title: z.string(),
    stageKey: StageKey,
    assigneeId: Id.nullable(),
    skillSlug: z.string().nullable(),
    status: SprintTaskStatus,
    createdAt: Timestamp,
  })
  .meta({ id: 'SprintTask' });

export const Project = z
  .object({
    id: Id,
    teamId: Id,
    teamName: z.string(),
    title: z.string(),
    idea: z.string(),
    assignmentId: Id.nullable(),
    challengeTaskId: Id.nullable(),
    status: z.enum(['active', 'completed', 'archived']),
    stages: z.array(Stage),
    tasks: z.array(SprintTask),
    evidence: z.array(Evidence).meta({ description: 'Для бизнеса — только подтверждённые' }),
    points: z.object({ team: z.number().int(), byMember: z.record(z.string(), z.number().int()) }),
    createdAt: Timestamp,
  })
  .meta({ id: 'SprintProject' });
export type Project = z.infer<typeof Project>;

export const ProjectSummary = z
  .object({
    id: Id,
    teamId: Id,
    teamName: z.string(),
    title: z.string(),
    currentStage: StageKey.nullable(),
    approvedStages: z.number().int(),
    challengeTaskId: Id.nullable(),
  })
  .meta({ id: 'SprintProjectSummary' });

export const CreateProjectInput = z
  .object({
    teamId: Id,
    title: z.string().trim().min(2).max(120),
    idea: z.string().trim().min(10).max(4000),
    startDate: DateOnly.optional().meta({ description: 'Начало спринта; по умолчанию сегодня. Плановые даты этапов считаются от неё.' }),
  })
  .meta({ id: 'CreateProjectInput' });

export const UpdateStagePlanInput = z.object({ plannedAt: DateOnly }).meta({ id: 'UpdateStagePlanInput' });

export const CreateSprintTaskInput = z
  .object({
    templateSlug: z.string().optional(),
    title: z.string().trim().min(2).max(160).optional(),
    stageKey: StageKey.optional(),
    skillSlug: z.string().nullable().optional(),
    assigneeId: Id.nullable().optional(),
  })
  .refine((v) => !!v.templateSlug || (!!v.title && !!v.stageKey), {
    message: 'Укажите шаблон или название и этап',
    path: ['title'],
  })
  .meta({ id: 'CreateSprintTaskInput' });

export const UpdateSprintTaskInput = z
  .object({
    assigneeId: Id.nullable().optional(),
    skillSlug: z.string().nullable().optional(),
    status: z.enum(['todo', 'in_progress']).optional(),
  })
  .meta({ id: 'UpdateSprintTaskInput' });

export const SubmitSprintEvidenceInput = z
  .object({
    target: z.enum(['stage', 'task', 'interview']).meta({
      description: 'stage — закрыть текущий этап; task — закрыть задачу; interview — ещё одно интервью с клиентом (не закрывает этап)',
    }),
    stageKey: StageKey.optional(),
    taskId: Id.optional(),
    kind: EvidenceKind,
    url: z.url().optional(),
    storagePath: z.string().optional(),
    note: z.string().trim().max(4000).default(''),
  })
  .refine((v) => (v.target === 'stage' ? !!v.stageKey : v.target === 'task' ? !!v.taskId : v.kind === 'interview'), {
    message: 'Для этапа нужен stageKey, для задачи — taskId, для интервью — kind=interview',
    path: ['target'],
  })
  .refine((v) => !!v.url || !!v.storagePath || v.note.length >= 20, {
    message: 'Приложите ссылку, файл или описание не короче 20 символов',
    path: ['url'],
  })
  .meta({ id: 'SubmitSprintEvidenceInput' });

export const Achievement = z
  .object({ code: z.string(), title: z.string(), earnedAt: Timestamp })
  .meta({ id: 'Achievement' });

export const FeedItem = z
  .object({
    type: z.enum(['points', 'achievement']),
    at: Timestamp,
    title: z.string(),
    points: z.number().int().nullable(),
    explanation: z.string(),
    subjectType: z.enum(['team', 'profile']),
    subjectId: Id,
  })
  .meta({ id: 'FeedItem' });

export const Feed = z.object({ items: z.array(FeedItem), achievements: z.array(Achievement) }).meta({ id: 'SprintFeed' });

export const NextStep = z
  .object({
    ruleId: z.string(),
    potentialPoints: z.number().int(),
    action: z.string().meta({ description: 'Что сделать (выбрано кодом)' }),
    text: z.string().meta({ description: 'Формулировка рекомендации (модель или шаблон)' }),
    generatedBy: z.enum(['ai', 'template']),
  })
  .meta({ id: 'NextStep' });

export const TaskTemplate = z
  .object({ slug: z.string(), title: z.string(), stageKey: StageKey, defaultSkillSlug: z.string().nullable(), description: z.string() })
  .meta({ id: 'TaskTemplate' });


export type ProjectSummary = z.infer<typeof ProjectSummary>;
export type TaskTemplate = z.infer<typeof TaskTemplate>;
export type Feed = z.infer<typeof Feed>;
export type NextStep = z.infer<typeof NextStep>;
export type SprintTask = z.infer<typeof SprintTask>;
