import { index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, ts } from '../../platform/db/columns.js';
import { profiles, roleEnum, teams } from '../identity/schema.js';

export const evidenceKindEnum = pgEnum('evidence_kind', ['link', 'screenshot', 'interview', 'report']);
export const evidenceStatusEnum = pgEnum('evidence_status', ['pending', 'approved', 'rejected', 'adjusted']);

/** Подтверждения результата и решение проверяющего. Модуль-владелец различается полем module, проверяющая роль — reviewer_role. */
export const evidence = pgTable(
  'evidence',
  {
    id: id(),
    module: text('module').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    submittedBy: uuid('submitted_by')
      .notNull()
      .references(() => profiles.id),
    kind: evidenceKindEnum('kind').notNull(),
    url: text('url'),
    storagePath: text('storage_path'),
    note: text('note').notNull().default(''),
    /** Who may review: each module routes its evidence to mentors (startup track) or teachers (learning track). */
    reviewerRole: roleEnum('reviewer_role').notNull().default('mentor'),
    status: evidenceStatusEnum('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => profiles.id),
    reviewComment: text('review_comment'),
    reviewedAt: ts('reviewed_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('evidence_status_idx').on(t.status, t.module),
    index('evidence_subject_idx').on(t.subjectType, t.subjectId),
    index('evidence_team_idx').on(t.teamId),
  ],
).enableRLS();
