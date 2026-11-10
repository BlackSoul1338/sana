import { index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from '../../platform/db/columns.js';
import { orgs, profiles } from '../../core/identity/schema.js';
import { tasks } from '../../core/catalog/schema.js';
import type { FieldState, Question, FieldChangeT } from './types.js';
import type { TaskCard, TaskRequirements } from '@sana/contracts';

export const draftStatusEnum = pgEnum('bcb_draft_status', ['collecting', 'composed', 'published']);
export const messageRoleEnum = pgEnum('bcb_message_role', ['user', 'assistant']);

export const bcbDrafts = pgTable(
  'bcb_drafts',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id),
    rawText: text('raw_text').notNull(),
    status: draftStatusEnum('status').notNull().default('collecting'),
    turnCount: integer('turn_count').notNull().default(0),
    readiness: integer('readiness').notNull().default(0),
    card: jsonb('card').$type<TaskCard>(),
    summary: text('summary'),
    requirements: jsonb('requirements').$type<TaskRequirements>(),
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    taskId: uuid('task_id').references(() => tasks.id),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('bcb_drafts_org_idx').on(t.orgId)],
).enableRLS();

export const bcbMessages = pgTable(
  'bcb_messages',
  {
    id: id(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => bcbDrafts.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    role: messageRoleEnum('role').notNull(),
    text: text('text').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('bcb_messages_draft_seq_uq').on(t.draftId, t.seq)],
).enableRLS();

/** Снимок статусов полей и готовности после каждого хода — основа сравнения «до и после». */
export const bcbAnalyses = pgTable(
  'bcb_analyses',
  {
    id: id(),
    draftId: uuid('draft_id')
      .notNull()
      .references(() => bcbDrafts.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => bcbMessages.id, { onDelete: 'cascade' }),
    turn: integer('turn').notNull(),
    fields: jsonb('fields').$type<FieldState[]>().notNull(),
    readiness: integer('readiness').notNull(),
    questions: jsonb('questions').$type<Question[]>().notNull(),
    changes: jsonb('changes').$type<FieldChangeT[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('bcb_analyses_draft_turn_uq').on(t.draftId, t.turn)],
).enableRLS();
