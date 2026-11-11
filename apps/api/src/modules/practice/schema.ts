import { check, index, integer, jsonb, pgEnum, pgTable, smallint, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { practice } from '@sana/contracts';
import { createdAt, id } from '../../platform/db/columns.js';
import { profiles } from '../../core/identity/schema.js';
import { evidence } from '../../core/evidence/schema.js';

export const attemptStatusEnum = pgEnum('pl_attempt_status', ['checked', 'sent', 'approved', 'rejected']);

/** Course modules: reference data loaded from data/practice-modules.json. */
export const plModules = pgTable('pl_modules', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  topics: text('topics').array().notNull(),
  position: smallint('position').notNull().default(0),
}).enableRLS();

export const plQuestions = pgTable(
  'pl_questions',
  {
    id: id(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => plModules.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    topic: text('topic').notNull(),
    text: text('text').notNull(),
    options: text('options').array().notNull(),
    correct: smallint('correct').notNull(),
    explanation: text('explanation').notNull(),
  },
  (t) => [index('pl_questions_module_idx').on(t.moduleId)],
).enableRLS();

export const plAssignments = pgTable(
  'pl_assignments',
  {
    id: id(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => plModules.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    condition: text('condition').notNull(),
    materials: text('materials').notNull().default(''),
    difficulty: smallint('difficulty').notNull(),
    criteria: jsonb('criteria').$type<practice.Criterion[]>().notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [index('pl_assignments_module_idx').on(t.moduleId), check('pl_assignments_difficulty_chk', sql`${t.difficulty} between 1 and 3`)],
).enableRLS();

export const plQuizAttempts = pgTable(
  'pl_quiz_attempts',
  {
    id: id(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => plModules.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').$type<{ questionId: string; option: number }[]>().notNull(),
    correct: integer('correct').notNull(),
    total: integer('total').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('pl_quiz_attempts_profile_idx').on(t.profileId, t.moduleId)],
).enableRLS();

export const plAttempts = pgTable(
  'pl_attempts',
  {
    id: id(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => plAssignments.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    attemptNo: integer('attempt_no').notNull(),
    answer: text('answer').notNull(),
    aiCheck: jsonb('ai_check').$type<practice.Check>(),
    status: attemptStatusEnum('status').notNull().default('checked'),
    evidenceId: uuid('evidence_id').references(() => evidence.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pl_attempts_no_uq').on(t.assignmentId, t.profileId, t.attemptNo), index('pl_attempts_profile_idx').on(t.profileId)],
).enableRLS();
