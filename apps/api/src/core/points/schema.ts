import { index, integer, pgEnum, pgTable, pgView, text, uuid, uniqueIndex, bigint } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createdAt, id } from '../../platform/db/columns.js';
import { evidence } from '../evidence/schema.js';
import { profiles } from '../identity/schema.js';

export const subjectTypeEnum = pgEnum('subject_type', ['team', 'profile', 'org']);

/**
 * Журнал баллов. Только дополняется: корректировка — это новое событие.
 * idempotency_key не даёт начислить одно правило дважды.
 */
export const pointEvents = pgTable(
  'point_events',
  {
    id: id(),
    subjectType: subjectTypeEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    module: text('module').notNull(),
    ruleId: text('rule_id').notNull(),
    points: integer('points').notNull(),
    explanation: text('explanation').notNull(),
    evidenceId: uuid('evidence_id').references(() => evidence.id),
    actorId: uuid('actor_id').references(() => profiles.id),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('point_events_idem_uq').on(t.idempotencyKey),
    index('point_events_subject_idx').on(t.subjectType, t.subjectId),
    index('point_events_evidence_idx').on(t.evidenceId),
  ],
).enableRLS();

/** Рейтинг как сумма журнала: отдельных счётчиков нет. */
export const vLeaderboard = pgView('v_leaderboard', {
  subjectType: subjectTypeEnum('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  total: bigint('total', { mode: 'number' }).notNull(),
  rank: bigint('rank', { mode: 'number' }).notNull(),
})
  .with({ securityInvoker: true })
  .as(sql`
  select subject_type, subject_id, sum(points)::bigint as total,
         rank() over (partition by subject_type order by sum(points) desc)::bigint as rank
  from point_events
  group by subject_type, subject_id
`);
