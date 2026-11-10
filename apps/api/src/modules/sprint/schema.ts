import { date, index, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from '../../platform/db/columns.js';
import { profiles, refSkills, teams } from '../../core/identity/schema.js';
import { assignments } from '../../core/catalog/schema.js';
import { evidence } from '../../core/evidence/schema.js';

export const STAGE_KEYS = ['idea', 'problem', 'interviews', 'prototype', 'testing'] as const;
export const stageKeyEnum = pgEnum('sprint_stage_key', STAGE_KEYS);
export const stageStatusEnum = pgEnum('sprint_stage_status', ['open', 'submitted', 'approved', 'rejected']);
export const projectStatusEnum = pgEnum('sprint_project_status', ['active', 'completed', 'archived']);
export const sprintTaskStatusEnum = pgEnum('sprint_task_status', ['todo', 'in_progress', 'submitted', 'done']);

export const sprintProjects = pgTable(
  'sprint_projects',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    idea: text('idea').notNull(),
    assignmentId: uuid('assignment_id').references(() => assignments.id, { onDelete: 'set null' }),
    status: projectStatusEnum('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('sprint_projects_team_idx').on(t.teamId)],
).enableRLS();

export const sprintStages = pgTable(
  'sprint_stages',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => sprintProjects.id, { onDelete: 'cascade' }),
    stageKey: stageKeyEnum('stage_key').notNull(),
    order: smallint('order').notNull(),
    status: stageStatusEnum('status').notNull().default('open'),
    plannedAt: date('planned_at', { mode: 'string' }).notNull(),
    completedAt: ts('completed_at'),
  },
  (t) => [uniqueIndex('sprint_stages_project_key_uq').on(t.projectId, t.stageKey)],
).enableRLS();

export const refTaskTemplates = pgTable('sprint_task_templates', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  stageKey: stageKeyEnum('stage_key').notNull(),
  defaultSkillSlug: text('default_skill_slug').references(() => refSkills.slug),
  description: text('description').notNull().default(''),
}).enableRLS();

export const sprintTasks = pgTable(
  'sprint_tasks',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => sprintProjects.id, { onDelete: 'cascade' }),
    templateSlug: text('template_slug').references(() => refTaskTemplates.slug),
    title: text('title').notNull(),
    stageKey: stageKeyEnum('stage_key').notNull(),
    assigneeId: uuid('assignee_id').references(() => profiles.id, { onDelete: 'set null' }),
    skillSlug: text('skill_slug').references(() => refSkills.slug),
    status: sprintTaskStatusEnum('status').notNull().default('todo'),
    createdAt: createdAt(),
  },
  (t) => [index('sprint_tasks_project_idx').on(t.projectId)],
).enableRLS();

export const sprintAchievements = pgTable(
  'sprint_achievements',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => sprintProjects.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    evidenceId: uuid('evidence_id').references(() => evidence.id),
    earnedAt: ts('earned_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sprint_achievements_project_code_uq').on(t.projectId, t.code)],
).enableRLS();
