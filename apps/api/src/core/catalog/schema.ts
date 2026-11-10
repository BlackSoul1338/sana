import { boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id, ts } from '../../platform/db/columns.js';
import { orgs, profiles, refSkills, teams } from '../identity/schema.js';

export const taskKindEnum = pgEnum('task_kind', ['business_challenge']);
export const taskStatusEnum = pgEnum('task_status', ['draft', 'published', 'archived']);
export const assignmentSourceEnum = pgEnum('assignment_source', ['manual', 'match']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['active', 'completed', 'cancelled']);

/** Общий каталог задач. Карточка из Challenge Builder лежит в payload. */
export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    kind: taskKindEnum('kind').notNull(),
    ownerOrgId: uuid('owner_org_id')
      .notNull()
      .references(() => orgs.id),
    status: taskStatusEnum('status').notNull().default('draft'),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    readiness: integer('readiness').notNull().default(0),
    topic: text('topic').notNull(),
    difficulty: smallint('difficulty').notNull(),
    estHours: integer('est_hours').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    sourceRef: text('source_ref'),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    publishedAt: ts('published_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('tasks_status_readiness_idx').on(t.status, t.readiness),
    index('tasks_owner_idx').on(t.ownerOrgId),
    check('tasks_readiness_chk', sql`${t.readiness} between 0 and 100`),
    check('tasks_difficulty_chk', sql`${t.difficulty} between 1 and 3`),
  ],
).enableRLS();

export const taskSkills = pgTable(
  'task_skills',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    skillSlug: text('skill_slug')
      .notNull()
      .references(() => refSkills.slug),
    required: boolean('required').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.skillSlug] })],
).enableRLS();

/** Закрепление задачи за командой. Создаётся только после подтверждения обеими сторонами. */
export const assignments = pgTable(
  'assignments',
  {
    id: id(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    source: assignmentSourceEnum('source').notNull(),
    status: assignmentStatusEnum('status').notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('assignments_task_team_uq').on(t.taskId, t.teamId), index('assignments_team_idx').on(t.teamId)],
).enableRLS();
