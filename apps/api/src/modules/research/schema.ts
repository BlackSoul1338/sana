import { index, integer, jsonb, pgEnum, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { research } from '@sana/contracts';
import { createdAt, id, ts } from '../../platform/db/columns.js';
import { profiles, teams } from '../../core/identity/schema.js';
import { evidence } from '../../core/evidence/schema.js';

export const workspaceStatusEnum = pgEnum('ra_workspace_status', ['active', 'submitted', 'approved']);
export const researchRoleEnum = pgEnum('ra_role', ['coordinator', 'researcher', 'critic', 'editor']);
export const itemKindEnum = pgEnum('ra_item_kind', ['argument', 'source', 'question']);
export const stanceEnum = pgEnum('ra_stance', ['for', 'against']);

export const raTasks = pgTable('ra_tasks', {
  id: id(),
  title: text('title').notNull(),
  question: text('question').notNull(),
  context: text('context').notNull().default(''),
  rubric: jsonb('rubric').$type<research.RubricItem[]>().notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => profiles.id),
  createdAt: createdAt(),
}).enableRLS();

export const raWorkspaces = pgTable(
  'ra_workspaces',
  {
    id: id(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => raTasks.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    initialPosition: text('initial_position').notNull(),
    status: workspaceStatusEnum('status').notNull().default('active'),
    summary: jsonb('summary').$type<research.Summary>(),
    summaryAt: ts('summary_at'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ra_workspaces_task_team_uq').on(t.taskId, t.teamId), index('ra_workspaces_team_idx').on(t.teamId)],
).enableRLS();

export const raRoles = pgTable(
  'ra_roles',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => raWorkspaces.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: researchRoleEnum('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.profileId] })],
).enableRLS();

export const raThreads = pgTable(
  'ra_threads',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => raWorkspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index('ra_threads_ws_idx').on(t.workspaceId)],
).enableRLS();

export const raMessages = pgTable(
  'ra_messages',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => raWorkspaces.id, { onDelete: 'cascade' }),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => raThreads.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id),
    text: text('text').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ra_messages_ws_time_idx').on(t.workspaceId, t.createdAt, t.id)],
).enableRLS();

export const raItems = pgTable(
  'ra_items',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => raWorkspaces.id, { onDelete: 'cascade' }),
    kind: itemKindEnum('kind').notNull(),
    text: text('text').notNull(),
    url: text('url'),
    threadId: uuid('thread_id').references(() => raThreads.id, { onDelete: 'set null' }),
    stance: stanceEnum('stance'),
    linkIds: uuid('link_ids').array().notNull().default([]),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index('ra_items_ws_idx').on(t.workspaceId)],
).enableRLS();

export const raConclusions = pgTable(
  'ra_conclusions',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => raWorkspaces.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    finalPosition: text('final_position').notNull(),
    statements: jsonb('statements').$type<{ text: string; itemIds: string[] }[]>().notNull(),
    assessment: jsonb('assessment').$type<research.Assessment>(),
    evidenceId: uuid('evidence_id').references(() => evidence.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ra_conclusions_version_uq').on(t.workspaceId, t.version)],
).enableRLS();
