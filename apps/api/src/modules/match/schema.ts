import { index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id, ts } from '../../platform/db/columns.js';
import { profiles, teams } from '../../core/identity/schema.js';
import { tasks } from '../../core/catalog/schema.js';
import { evidence } from '../../core/evidence/schema.js';
import type { match } from '@sana/contracts';

type Fit = match.Fit;

export const applicationStatusEnum = pgEnum('match_application_status', ['pending', 'accepted', 'declined', 'withdrawn']);
export const feedbackVerdictEnum = pgEnum('match_feedback_verdict', ['positive', 'needs_work']);

export const matchApplications = pgTable(
  'match_applications',
  {
    id: id(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    status: applicationStatusEnum('status').notNull().default('pending'),
    score: integer('score').notNull(),
    fit: jsonb('fit').$type<Fit>().notNull(),
    message: text('message').notNull().default(''),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    decidedBy: uuid('decided_by').references(() => profiles.id),
    decisionComment: text('decision_comment'),
    decidedAt: ts('decided_at'),
    createdAt: createdAt(),
  },
  (t) => [
    // Одна живая заявка команды на задачу; отклонённые и отозванные не мешают подать снова.
    uniqueIndex('match_applications_live_uq')
      .on(t.teamId, t.taskId)
      .where(sql`${t.status} in ('pending', 'accepted')`),
    index('match_applications_task_idx').on(t.taskId),
  ],
).enableRLS();

/** Отзыв бизнеса на подтверждённый этап. Положительный отзыв даёт коэффициент реальной задачи. */
export const matchFeedback = pgTable(
  'match_feedback',
  {
    id: id(),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidence.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id),
    verdict: feedbackVerdictEnum('verdict').notNull(),
    comment: text('comment').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('match_feedback_evidence_uq').on(t.evidenceId)],
).enableRLS();
