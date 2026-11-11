import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AdjustmentInput, LeaderboardEntry, PointEvent, SubjectType } from '@sana/contracts';
import { requireProfile, requireRole, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso } from '../../platform/db/columns.js';
import { pointEvents } from './schema.js';

export type Award = {
  subjectType: SubjectType;
  subjectId: string;
  module: string;
  ruleId: string;
  points: number;
  explanation: string;
  evidenceId?: string | null;
  actorId?: string | null;
  /** Правило + объект: повторный вызов с тем же ключом ничего не начислит. */
  idempotencyKey: string;
};

type Row = typeof pointEvents.$inferSelect;

export const toPointEvent = (r: Row): PointEvent => ({
  id: r.id,
  subjectType: r.subjectType,
  subjectId: r.subjectId,
  module: r.module,
  ruleId: r.ruleId,
  points: r.points,
  explanation: r.explanation,
  evidenceId: r.evidenceId,
  actorId: r.actorId,
  createdAt: iso(r.createdAt),
});

/**
 * Единственная точка записи баллов. Журнал только дополняется; дубли по idempotency_key пропускаются.
 * Возвращает фактически записанные события.
 */
export async function award(db: DbLike, awards: Award[]): Promise<Row[]> {
  const rows = awards.filter((a) => a.points !== 0);
  if (!rows.length) return [];
  return db
    .insert(pointEvents)
    .values(
      rows.map((a) => ({
        subjectType: a.subjectType,
        subjectId: a.subjectId,
        module: a.module,
        ruleId: a.ruleId,
        points: Math.trunc(a.points),
        explanation: a.explanation,
        evidenceId: a.evidenceId ?? null,
        actorId: a.actorId ?? null,
        idempotencyKey: a.idempotencyKey,
      })),
    )
    .onConflictDoNothing({ target: pointEvents.idempotencyKey })
    .returning();
}

/** Корректировка куратором: новое событие с комментарием, старые не меняются. */
export async function adjust(ctx: Ctx, input: z.infer<typeof AdjustmentInput>): Promise<PointEvent> {
  const mentor = requireRole(ctx, 'mentor');
  const [row] = await award(ctx.db, [
    {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      module: input.module,
      ruleId: 'mentor_adjustment',
      points: input.points,
      explanation: `Корректировка куратора: ${input.comment}`,
      actorId: mentor.id,
      idempotencyKey: `mentor_adjustment:${randomUUID()}`,
    },
  ]);
  return toPointEvent(row!);
}

export async function listEvents(ctx: Ctx, q: { subjectType: SubjectType; subjectId: string }): Promise<PointEvent[]> {
  requireProfile(ctx);
  const rows = await ctx.db
    .select()
    .from(pointEvents)
    .where(and(eq(pointEvents.subjectType, q.subjectType), eq(pointEvents.subjectId, q.subjectId)))
    .orderBy(desc(pointEvents.createdAt));
  return rows.map(toPointEvent);
}

export async function eventsForSubjects(db: DbLike, subjectIds: string[]): Promise<Row[]> {
  if (!subjectIds.length) return [];
  return db.select().from(pointEvents).where(inArray(pointEvents.subjectId, subjectIds)).orderBy(desc(pointEvents.createdAt));
}

export async function eventsForEvidence(db: DbLike, evidenceId: string): Promise<Row[]> {
  return db.select().from(pointEvents).where(eq(pointEvents.evidenceId, evidenceId));
}

/** Totals for several subjects in one query; subjects without events get 0. */
export async function totalsFor(db: DbLike, subjectType: SubjectType, subjectIds: string[], module?: string): Promise<Map<string, number>> {
  const totals = new Map(subjectIds.map((id) => [id, 0]));
  if (subjectIds.length === 0) return totals;
  const rows = await db
    .select({ subjectId: pointEvents.subjectId, total: sql<number>`coalesce(sum(${pointEvents.points}), 0)::int` })
    .from(pointEvents)
    .where(
      and(
        eq(pointEvents.subjectType, subjectType),
        inArray(pointEvents.subjectId, subjectIds),
        module ? eq(pointEvents.module, module) : undefined,
      ),
    )
    .groupBy(pointEvents.subjectId);
  for (const r of rows) totals.set(r.subjectId, r.total);
  return totals;
}

export async function totalFor(db: DbLike, subjectType: SubjectType, subjectId: string, module?: string): Promise<number> {
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${pointEvents.points}), 0)::int` })
    .from(pointEvents)
    .where(
      and(
        eq(pointEvents.subjectType, subjectType),
        eq(pointEvents.subjectId, subjectId),
        module ? eq(pointEvents.module, module) : undefined,
      ),
    );
  return r?.total ?? 0;
}

export async function existsKey(db: DbLike, idempotencyKey: string): Promise<boolean> {
  const [r] = await db.select({ id: pointEvents.id }).from(pointEvents).where(eq(pointEvents.idempotencyKey, idempotencyKey)).limit(1);
  return !!r;
}

export async function countByRule(db: DbLike, subjectType: SubjectType, subjectId: string, ruleId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pointEvents)
    .where(and(eq(pointEvents.subjectType, subjectType), eq(pointEvents.subjectId, subjectId), eq(pointEvents.ruleId, ruleId)));
  return r?.n ?? 0;
}

const NAME_SQL: Record<SubjectType, ReturnType<typeof sql>> = {
  team: sql`(select name from teams where teams.id = s.subject_id)`,
  profile: sql`(select display_name from profiles where profiles.id = s.subject_id)`,
  org: sql`(select name from orgs where orgs.id = s.subject_id)`,
};

/** Рейтинг: сумма журнала по субъекту, при необходимости — только по одному модулю. */
export async function leaderboard(
  ctx: Ctx,
  q: { subjectType: SubjectType; module?: string | undefined; limit: number },
): Promise<LeaderboardEntry[]> {
  requireProfile(ctx);
  const moduleFilter = q.module ? sql`and module = ${q.module}` : sql``;
  const rows = await ctx.db.execute<{ subject_id: string; total: number; rank: number; name: string | null }>(sql`
    select s.subject_id, s.total, s.rank, ${NAME_SQL[q.subjectType]} as name
    from (
      select subject_id, sum(points)::int as total,
             rank() over (order by sum(points) desc)::int as rank
      from point_events
      where subject_type = ${q.subjectType} ${moduleFilter}
      group by subject_id
    ) s
    order by s.rank, name
    limit ${q.limit}
  `);
  return [...rows].map((r) => ({
    subjectType: q.subjectType,
    subjectId: r.subject_id,
    name: r.name ?? '—',
    total: Number(r.total),
    rank: Number(r.rank),
  }));
}
