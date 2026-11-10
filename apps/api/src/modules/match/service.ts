import { and, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { match } from '@sana/contracts';
import { requireProfile, requireRole, type Ctx } from '../../platform/context.js';
import { iso, isoOrNull } from '../../platform/db/columns.js';
import { conflict, forbidden, notFound, rule } from '../../platform/errors.js';
import { getTeamMatchProfile, isTeamMember, requireTeamAccess, skillMap, teamNames } from '../../core/identity/service.js';
import { activeAssignments, findTask, publishedTasks, tasksByIds } from '../../core/catalog/service.js';
import { findEvidence, isApprovedStatus } from '../../core/evidence/service.js';
import { award, eventsForEvidence } from '../../core/points/ledger.js';
import { computeFit, growthPlan, rankTasks } from './scoring.js';
import { matchApplications, matchFeedback } from './schema.js';

const MODULE = 'match';
/** Работа над реальной задачей бизнеса: коэффициент 1.25 к баллам команды за подтверждённый результат. */
export const REAL_TASK_BONUS_SHARE = 0.25;
export const MIN_RECOMMENDATIONS = 5;

type AppRow = typeof matchApplications.$inferSelect;

async function toApplications(ctx: Ctx, rows: AppRow[]): Promise<match.Application[]> {
  const [names, tasks] = await Promise.all([
    teamNames(ctx.db, [...new Set(rows.map((r) => r.teamId))]),
    tasksByIds(ctx.db, [...new Set(rows.map((r) => r.taskId))]),
  ]);
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  return rows.map((r) => ({
    id: r.id,
    teamId: r.teamId,
    teamName: names.get(r.teamId) ?? '—',
    taskId: r.taskId,
    taskTitle: titles.get(r.taskId) ?? '—',
    status: r.status,
    score: r.score,
    fit: r.fit,
    message: r.message,
    decisionComment: r.decisionComment,
    createdAt: iso(r.createdAt),
    decidedAt: isoOrNull(r.decidedAt),
  }));
}

/**
 * Рекомендации задач команде. Используются только навыки, время и интересы команды.
 * Задачи, уже закреплённые за командой или с живой заявкой, не предлагаются.
 */
export async function recommend(ctx: Ctx, q: z.infer<typeof match.RecommendationsQuery>): Promise<match.RecommendationsResult> {
  await requireTeamAccess(ctx, q.teamId);
  const [team, info, all, assigned, live] = await Promise.all([
    getTeamMatchProfile(ctx.db, q.teamId),
    skillMap(ctx.db),
    publishedTasks(ctx.db, {}),
    activeAssignments(ctx.db, { teamId: q.teamId }),
    ctx.db
      .select({ taskId: matchApplications.taskId })
      .from(matchApplications)
      .where(and(eq(matchApplications.teamId, q.teamId), inArray(matchApplications.status, ['pending', 'accepted']))),
  ]);
  const excluded = new Set([...assigned.map((a) => a.taskId), ...live.map((l) => l.taskId)]);
  const open = all.filter((t) => !excluded.has(t.id));
  const filtered = open.filter(
    (t) => (!q.topic || t.topic === q.topic.trim().toLowerCase()) && (!q.difficulty || t.difficulty === q.difficulty),
  );
  const ranked = rankTasks(team, filtered, info).slice(0, Math.max(MIN_RECOMMENDATIONS, q.limit));
  return {
    teamId: q.teamId,
    items: ranked.map(({ task, fit }) => ({
      taskId: task.id,
      title: task.title,
      orgName: task.ownerOrgName,
      topic: task.topic,
      difficulty: task.difficulty,
      estHours: task.estHours,
      readiness: task.readiness,
      fit,
    })),
    growth: growthPlan(team, open, info),
  };
}

export async function fitForTask(ctx: Ctx, taskId: string, teamId: string): Promise<match.Fit> {
  await requireTeamAccess(ctx, teamId);
  const [task] = await tasksByIds(ctx.db, [taskId]);
  if (!task || task.status !== 'published') throw notFound('Задача');
  return computeFit(await getTeamMatchProfile(ctx.db, teamId), task, await skillMap(ctx.db));
}

/** Отклик команды. Баллы за сам выбор задачи не начисляются. */
export async function apply(ctx: Ctx, input: z.infer<typeof match.ApplyInput>): Promise<match.Application> {
  const p = requireRole(ctx, 'student');
  if (!(await isTeamMember(ctx.db, input.teamId, p.id))) throw forbidden('Откликается участник команды');
  const [task] = await tasksByIds(ctx.db, [input.taskId]);
  if (!task || task.status !== 'published') throw notFound('Задача');
  if ((await activeAssignments(ctx.db, { teamId: input.teamId, taskId: input.taskId })).length) throw conflict('Задача уже закреплена за командой');
  const fit = computeFit(await getTeamMatchProfile(ctx.db, input.teamId), task, await skillMap(ctx.db));
  const [live] = await ctx.db
    .select({ id: matchApplications.id })
    .from(matchApplications)
    .where(and(eq(matchApplications.teamId, input.teamId), eq(matchApplications.taskId, input.taskId), inArray(matchApplications.status, ['pending', 'accepted'])))
    .limit(1);
  if (live) throw conflict('У команды уже есть заявка на эту задачу');
  const [row] = await ctx.db
    .insert(matchApplications)
    .values({ teamId: input.teamId, taskId: input.taskId, score: fit.score, fit, message: input.message, createdBy: p.id, createdAt: ctx.now })
    .returning();
  return (await toApplications(ctx, [row!]))[0]!;
}

export async function withdraw(ctx: Ctx, id: string): Promise<match.Application> {
  const p = requireRole(ctx, 'student');
  const [row] = await ctx.db.select().from(matchApplications).where(eq(matchApplications.id, id)).limit(1);
  if (!row) throw notFound('Заявка');
  if (!(await isTeamMember(ctx.db, row.teamId, p.id))) throw forbidden();
  if (row.status !== 'pending') throw conflict('Отозвать можно только заявку на рассмотрении');
  const [upd] = await ctx.db.update(matchApplications).set({ status: 'withdrawn', decidedAt: ctx.now }).where(eq(matchApplications.id, id)).returning();
  return (await toApplications(ctx, [upd!]))[0]!;
}

export async function listApplications(ctx: Ctx, q: { teamId?: string | undefined; taskId?: string | undefined }): Promise<match.Application[]> {
  const p = requireProfile(ctx);
  if (q.teamId) await requireTeamAccess(ctx, q.teamId);
  if (q.taskId && p.role !== 'mentor') {
    const task = await findTask(ctx.db, q.taskId);
    if (!task) throw notFound('Задача');
    if (p.role !== 'business' || task.ownerOrgId !== p.orgId) {
      if (!q.teamId) throw forbidden('Заявки на задачу видит её владелец');
    }
  }
  const rows = await ctx.db
    .select()
    .from(matchApplications)
    .where(and(q.teamId ? eq(matchApplications.teamId, q.teamId) : undefined, q.taskId ? eq(matchApplications.taskId, q.taskId) : undefined))
    .orderBy(desc(matchApplications.score), desc(matchApplications.createdAt));
  return toApplications(ctx, rows);
}

/**
 * Решение представителя бизнеса по заявке. Рекомендация — не назначение:
 * сотрудничество начинается, только когда обе стороны подтвердили.
 */
export async function decide(ctx: Ctx, id: string, input: z.infer<typeof match.DecisionInput>): Promise<{ app: AppRow; dto: match.Application }> {
  const p = requireRole(ctx, 'business');
  const [row] = await ctx.db.select().from(matchApplications).where(eq(matchApplications.id, id)).for('update').limit(1);
  if (!row) throw notFound('Заявка');
  const task = await findTask(ctx.db, row.taskId);
  if (!task || task.ownerOrgId !== p.orgId) throw forbidden('Решение принимает организация — владелец задачи');
  if (row.status !== 'pending') throw conflict(`Заявка уже рассмотрена (статус ${row.status})`);
  const [upd] = await ctx.db
    .update(matchApplications)
    .set({ status: input.decision === 'accept' ? 'accepted' : 'declined', decidedBy: p.id, decisionComment: input.comment || null, decidedAt: ctx.now })
    .where(eq(matchApplications.id, id))
    .returning();
  return { app: upd!, dto: (await toApplications(ctx, [upd!]))[0]! };
}

/**
 * Отзыв бизнеса на подтверждённый куратором результат команды, работающей над его задачей.
 * Положительный отзыв даёт коэффициент реальной задачи: +25% к баллам команды за это подтверждение.
 */
export async function feedback(ctx: Ctx, input: z.infer<typeof match.FeedbackInput>): Promise<match.FeedbackResult> {
  const p = requireRole(ctx, 'business');
  const ev = await findEvidence(ctx.db, input.evidenceId);
  if (!ev || !ev.teamId) throw notFound('Подтверждение');
  const assignments = await activeAssignments(ctx.db, { teamId: ev.teamId });
  const tasks = await tasksByIds(ctx.db, assignments.map((a) => a.taskId));
  const ownTask = tasks.find((t) => t.ownerOrgId === p.orgId);
  if (!ownTask) throw forbidden('Отзыв оставляет бизнес-заказчик задачи, над которой работает команда');
  if (!isApprovedStatus(ev.status)) throw rule('Сначала результат должен подтвердить куратор');

  const [existing] = await ctx.db.select().from(matchFeedback).where(eq(matchFeedback.evidenceId, ev.id)).limit(1);
  if (existing?.verdict === 'positive') throw conflict('Положительный отзыв уже оставлен');
  if (existing) {
    await ctx.db.update(matchFeedback).set({ verdict: input.verdict, comment: input.comment, updatedAt: ctx.now }).where(eq(matchFeedback.id, existing.id));
  } else {
    await ctx.db.insert(matchFeedback).values({ evidenceId: ev.id, taskId: ownTask.id, teamId: ev.teamId, authorId: p.id, verdict: input.verdict, comment: input.comment, createdAt: ctx.now });
  }

  let bonusPoints = 0;
  if (input.verdict === 'positive') {
    const base = (await eventsForEvidence(ctx.db, ev.id))
      .filter((e) => e.subjectType === 'team' && e.module !== MODULE && e.ruleId !== 'mentor_adjustment')
      .reduce((s, e) => s + e.points, 0);
    bonusPoints = Math.round(base * REAL_TASK_BONUS_SHARE);
    if (bonusPoints > 0) {
      await award(ctx.db, [
        {
          subjectType: 'team',
          subjectId: ev.teamId,
          module: MODULE,
          ruleId: 'real_task_bonus',
          points: bonusPoints,
          explanation: `Реальная задача «${ownTask.title}»: бизнес подтвердил результат, коэффициент ×1.25 к ${base} баллам: +${bonusPoints}`,
          evidenceId: ev.id,
          actorId: p.id,
          idempotencyKey: `match:real_task_bonus:${ev.id}`,
        },
      ]);
    }
  }
  return { evidenceId: ev.id, verdict: input.verdict, bonusPoints };
}
