import { z } from 'zod';
import { Difficulty, Id, PageQuery, Timestamp } from './common.js';

export const TaskStatus = z.enum(['draft', 'published', 'archived']);
export const TaskKind = z.enum(['business_challenge']);

export const TaskSkillReq = z.object({ slug: z.string(), required: z.boolean() }).meta({ id: 'TaskSkillReq' });

/** Структурные требования задачи — нужны подбору команд (кейс 3). */
export const TaskRequirements = z
  .object({
    topic: z.string().trim().min(2).max(60),
    difficulty: Difficulty,
    estHours: z.number().int().min(4).max(400).meta({ description: 'Оценка трудоёмкости в часах на весь проект' }),
    skills: z.array(TaskSkillReq).min(1).max(12),
  })
  .meta({ id: 'TaskRequirements' });
export type TaskRequirements = z.infer<typeof TaskRequirements>;

export const CardFieldKey = z.enum(['title', 'context', 'goal', 'users', 'data', 'constraints', 'criteria']);
export type CardFieldKey = z.infer<typeof CardFieldKey>;

export const CardField = z
  .object({
    text: z.string(),
    source: z.enum(['dialog', 'not_specified']).meta({ description: 'Откуда взято: из ответов бизнеса или «не указано»' }),
  })
  .meta({ id: 'CardField' });

/** Карточка практической задачи: семь полей из кейса 2. */
export const TaskCard = z
  .object({
    title: CardField,
    context: CardField,
    goal: CardField,
    users: CardField,
    data: CardField,
    constraints: CardField,
    criteria: CardField,
  })
  .meta({ id: 'TaskCard' });
export type TaskCard = z.infer<typeof TaskCard>;

export const Task = z
  .object({
    id: Id,
    kind: TaskKind,
    ownerOrgId: Id,
    ownerOrgName: z.string(),
    status: TaskStatus,
    title: z.string(),
    summary: z.string(),
    readiness: z.number().int().min(0).max(100),
    topic: z.string(),
    difficulty: Difficulty,
    estHours: z.number().int(),
    skills: z.array(TaskSkillReq),
    card: TaskCard.nullable(),
    publishedAt: Timestamp.nullable(),
    createdAt: Timestamp,
  })
  .meta({ id: 'Task' });
export type Task = z.infer<typeof Task>;

export const TaskListQuery = PageQuery.extend({
  topic: z.string().optional(),
  difficulty: z.coerce.number().int().min(1).max(3).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .meta({ description: 'Для бизнеса: задачи своей организации в любом статусе' }),
});

export const Assignment = z
  .object({
    id: Id,
    taskId: Id,
    teamId: Id,
    source: z.enum(['manual', 'match']),
    status: z.enum(['active', 'completed', 'cancelled']),
    createdAt: Timestamp,
  })
  .meta({ id: 'Assignment' });
export type Assignment = z.infer<typeof Assignment>;
