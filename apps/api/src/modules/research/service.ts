import { and, asc, count, desc, eq, gt, inArray, max, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { research } from '@sana/contracts';
import { inTx, requireProfile, requireRole, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso } from '../../platform/db/columns.js';
import { AppError, conflict, forbidden, invalid, notFound } from '../../platform/errors.js';
import { profiles, teamMembers } from '../../core/identity/schema.js';
import { isTeamMember, teamIdsOf, teamNames } from '../../core/identity/service.js';
import { createEvidence } from '../../core/evidence/service.js';
import { totalsFor } from '../../core/points/ledger.js';
import { assessConclusion, summarize } from './ai.js';
import { argumentMap, checkStatements, citedIds, contributions, positionGrowth, verifyGrowth } from './rules.js';
import { raConclusions, raItems, raMessages, raRoles, raTasks, raThreads, raWorkspaces } from './schema.js';
import { MODULE, SUBJECT } from './types.js';

export const RUBRIC_TITLES: Record<research.RubricItem['key'], string> = {
  argumentation: 'Обоснованность аргументов',
  completeness: 'Полнота исследования',
  understanding: 'Точность понимания проблемы',
  originality: 'Оригинальность решения',
};

type TaskRow = typeof raTasks.$inferSelect;
type WsRow = typeof raWorkspaces.$inferSelect;
type ItemRow = typeof raItems.$inferSelect;
type ConclusionRow = typeof raConclusions.$inferSelect;

const toTask = (t: TaskRow) => ({ id: t.id, title: t.title, question: t.question, context: t.context, rubric: t.rubric, createdAt: iso(t.createdAt) });
const toItem = (i: ItemRow): research.Item => ({
  id: i.id,
  kind: i.kind,
  text: i.text,
  url: i.url,
  threadId: i.threadId,
  stance: i.stance,
  linkIds: i.linkIds,
  createdBy: i.createdBy,
  createdAt: iso(i.createdAt),
});
const toConclusion = (c: ConclusionRow, items: ItemRow[]): research.Conclusion => ({
  id: c.id,
  version: c.version,
  finalPosition: c.finalPosition,
  statements: c.statements,
  assessment: c.assessment ?? null,
  growth: positionGrowth(c.statements, items),
  evidenceId: c.evidenceId,
  createdAt: iso(c.createdAt),
});

/** Team members work in the workspace; teachers read it and review the conclusion. */
async function access(ctx: Ctx, id: string, write = false) {
  const p = requireRole(ctx, 'student', 'teacher');
  const [ws] = await ctx.db.select().from(raWorkspaces).where(eq(raWorkspaces.id, id)).limit(1);
  if (!ws) throw notFound('Исследование');
  if (p.role === 'teacher') {
    if (write) throw forbidden('Преподаватель не участвует в обсуждении команды');
    return { ws, p };
  }
  if (!(await isTeamMember(ctx.db, ws.teamId, p.id))) throw forbidden();
  if (write && ws.status === 'approved') throw conflict('Исследование уже принято');
  return { ws, p };
}

export async function listTasks(ctx: Ctx) {
  requireProfile(ctx);
  return (await ctx.db.select().from(raTasks).orderBy(desc(raTasks.createdAt))).map(toTask);
}

export async function createTask(ctx: Ctx, input: z.infer<typeof research.NewTask>) {
  const p = requireRole(ctx, 'teacher');
  const [row] = await ctx.db
    .insert(raTasks)
    .values({
      title: input.title,
      question: input.question,
      context: input.context,
      rubric: input.rubric.map((r) => ({ key: r.key, title: RUBRIC_TITLES[r.key], description: r.description, maxPoints: r.maxPoints })),
      createdBy: p.id,
      createdAt: ctx.now,
    })
    .returning();
  return toTask(row!);
}

export async function startWorkspace(ctx: Ctx, taskId: string, input: z.infer<typeof research.StartInput>) {
  const p = requireRole(ctx, 'student');
  const [task] = await ctx.db.select({ id: raTasks.id }).from(raTasks).where(eq(raTasks.id, taskId)).limit(1);
  if (!task) throw notFound('Задача');
  if (!(await isTeamMember(ctx.db, input.teamId, p.id))) throw forbidden('Исследование начинает участник команды');
  const [row] = await ctx.db
    .insert(raWorkspaces)
    .values({ taskId, teamId: input.teamId, initialPosition: input.initialPosition, createdBy: p.id, createdAt: ctx.now })
    .onConflictDoNothing()
    .returning();
  if (!row) throw conflict('Команда уже исследует эту задачу');
  return getWorkspace(ctx, row.id);
}

export async function listWorkspaces(ctx: Ctx, q: z.infer<typeof research.WorkspacesQuery>): Promise<z.infer<typeof research.WorkspaceSummary>[]> {
  const p = requireRole(ctx, 'student', 'teacher');
  let teamFilter: string[] | undefined;
  if (p.role === 'student') {
    teamFilter = await teamIdsOf(ctx.db, p.id);
    if (!teamFilter.length) return [];
  }
  const rows = await ctx.db
    .select({ ws: raWorkspaces, taskTitle: raTasks.title })
    .from(raWorkspaces)
    .innerJoin(raTasks, eq(raTasks.id, raWorkspaces.taskId))
    .where(
      and(
        teamFilter ? inArray(raWorkspaces.teamId, teamFilter) : undefined,
        q.taskId ? eq(raWorkspaces.taskId, q.taskId) : undefined,
        q.teamId ? eq(raWorkspaces.teamId, q.teamId) : undefined,
      ),
    )
    .orderBy(desc(raWorkspaces.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.ws.id);
  const teamIds = [...new Set(rows.map((r) => r.ws.teamId))];
  const [names, itemCounts, totals] = await Promise.all([
    teamNames(ctx.db, teamIds),
    ctx.db.select({ id: raItems.workspaceId, n: count() }).from(raItems).where(inArray(raItems.workspaceId, ids)).groupBy(raItems.workspaceId),
    totalsFor(ctx.db, 'team', teamIds, MODULE),
  ]);
  const n = new Map(itemCounts.map((r) => [r.id, Number(r.n)]));
  return rows.map(({ ws, taskTitle }) => ({
    id: ws.id,
    taskId: ws.taskId,
    taskTitle,
    teamId: ws.teamId,
    teamName: names.get(ws.teamId) ?? '',
    status: ws.status,
    items: n.get(ws.id) ?? 0,
    points: totals.get(ws.teamId) ?? 0,
    createdAt: iso(ws.createdAt),
  }));
}

async function loadBoard(db: DbLike, ws: WsRow) {
  const [members, roles, threads, items, [conclusion], [task]] = await Promise.all([
    db
      .select({ id: profiles.id, name: profiles.displayName })
      .from(teamMembers)
      .innerJoin(profiles, eq(profiles.id, teamMembers.profileId))
      .where(eq(teamMembers.teamId, ws.teamId))
      .orderBy(asc(profiles.displayName)),
    db.select().from(raRoles).where(eq(raRoles.workspaceId, ws.id)),
    db.select().from(raThreads).where(eq(raThreads.workspaceId, ws.id)).orderBy(asc(raThreads.createdAt)),
    db.select().from(raItems).where(eq(raItems.workspaceId, ws.id)).orderBy(asc(raItems.createdAt)),
    db.select().from(raConclusions).where(eq(raConclusions.workspaceId, ws.id)).orderBy(desc(raConclusions.version)).limit(1),
    db.select().from(raTasks).where(eq(raTasks.id, ws.taskId)).limit(1),
  ]);
  return { members, roles, threads, items, conclusion, task: task! };
}

export async function getWorkspace(ctx: Ctx, id: string): Promise<z.infer<typeof research.Workspace>> {
  const { ws } = await access(ctx, id);
  const b = await loadBoard(ctx.db, ws);
  const [names, totals] = await Promise.all([teamNames(ctx.db, [ws.teamId]), totalsFor(ctx.db, 'team', [ws.teamId], MODULE)]);
  const cited = b.conclusion ? citedIds(b.conclusion.statements) : new Set<string>();
  const roleOf = new Map(b.roles.map((r) => [r.profileId, r.role]));
  const nameOf = new Map(b.members.map((m) => [m.id, m.name]));
  return {
    id: ws.id,
    task: toTask(b.task),
    teamId: ws.teamId,
    teamName: names.get(ws.teamId) ?? '',
    status: ws.status,
    initialPosition: ws.initialPosition,
    threads: b.threads.map((t) => ({ id: t.id, title: t.title, createdBy: t.createdBy, createdAt: iso(t.createdAt) })),
    items: b.items.map(toItem),
    summary: ws.summary ?? null,
    argumentMap: argumentMap(b.threads.map((t) => t.id), b.items),
    contribution: contributions(b.members.map((m) => m.id), roleOf, b.items, cited).map((c) => ({ ...c, name: nameOf.get(c.profileId) ?? '' })),
    conclusion: b.conclusion ? toConclusion(b.conclusion, b.items) : null,
    points: totals.get(ws.teamId) ?? 0,
    createdAt: iso(ws.createdAt),
  };
}

export async function setRoles(ctx: Ctx, id: string, input: z.infer<typeof research.RolesInput>) {
  const { ws } = await access(ctx, id, true);
  const memberIds = new Set((await ctx.db.select({ id: teamMembers.profileId }).from(teamMembers).where(eq(teamMembers.teamId, ws.teamId))).map((r) => r.id));
  const bad = input.roles.findIndex((r) => !memberIds.has(r.profileId));
  if (bad >= 0) throw invalid('Роль получает участник команды', [{ path: `roles.${bad}.profileId`, message: 'Не участник команды' }]);
  await inTx(ctx, async (t) => {
    await t.db.delete(raRoles).where(eq(raRoles.workspaceId, ws.id));
    if (input.roles.length) await t.db.insert(raRoles).values(input.roles.map((r) => ({ workspaceId: ws.id, ...r })));
  });
  return getWorkspace(ctx, ws.id);
}

export async function createThread(ctx: Ctx, id: string, input: z.infer<typeof research.NewThread>) {
  const { ws, p } = await access(ctx, id, true);
  const [row] = await ctx.db.insert(raThreads).values({ workspaceId: ws.id, title: input.title, createdBy: p.id, createdAt: ctx.now }).returning();
  return { id: row!.id, title: row!.title, createdBy: row!.createdBy, createdAt: iso(row!.createdAt) };
}

export async function postMessage(ctx: Ctx, threadId: string, input: z.infer<typeof research.NewMessage>) {
  const [thread] = await ctx.db.select().from(raThreads).where(eq(raThreads.id, threadId)).limit(1);
  if (!thread) throw notFound('Ветка');
  const { ws, p } = await access(ctx, thread.workspaceId, true);
  const [row] = await ctx.db.insert(raMessages).values({ workspaceId: ws.id, threadId, authorId: p.id, text: input.text, createdAt: ctx.now }).returning();
  return { id: row!.id, threadId, authorId: p.id, text: row!.text, createdAt: iso(row!.createdAt) };
}

const PAGE = 200;
const encode = (r: { createdAt: Date; id: string }) => `${r.createdAt.toISOString()}|${r.id}`;

/** Ascending page after the cursor; the client polls with nextCursor (or the last cursor when null). */
export async function listMessages(ctx: Ctx, id: string, cursor?: string) {
  const { ws } = await access(ctx, id);
  let after: { at: Date; id: string } | undefined;
  if (cursor) {
    const [at, mid] = cursor.split('|');
    const d = new Date(at ?? '');
    if (Number.isNaN(d.getTime()) || !mid) throw invalid('Неверный курсор', [{ path: 'cursor', message: 'Ожидается курсор из ответа' }]);
    after = { at: d, id: mid };
  }
  const rows = await ctx.db
    .select()
    .from(raMessages)
    .where(
      and(
        eq(raMessages.workspaceId, ws.id),
        after ? or(gt(raMessages.createdAt, after.at), and(eq(raMessages.createdAt, after.at), gt(raMessages.id, after.id))) : undefined,
      ),
    )
    .orderBy(asc(raMessages.createdAt), asc(raMessages.id))
    .limit(PAGE);
  return {
    items: rows.map((m) => ({ id: m.id, threadId: m.threadId, authorId: m.authorId, text: m.text, createdAt: iso(m.createdAt) })),
    nextCursor: rows.length ? encode(rows.at(-1)!) : (cursor ?? null),
  };
}

export async function addItem(ctx: Ctx, id: string, input: z.infer<typeof research.NewItem>) {
  const { ws, p } = await access(ctx, id, true);
  const own = await ctx.db.select({ id: raItems.id }).from(raItems).where(eq(raItems.workspaceId, ws.id));
  const ownIds = new Set(own.map((r) => r.id));
  const bad = input.linkIds.findIndex((l) => !ownIds.has(l));
  if (bad >= 0) throw invalid('Связь только с элементами этой доски', [{ path: `linkIds.${bad}`, message: 'Элемент не найден' }]);
  if (input.threadId) {
    const [t] = await ctx.db.select({ ws: raThreads.workspaceId }).from(raThreads).where(eq(raThreads.id, input.threadId)).limit(1);
    if (t?.ws !== ws.id) throw invalid('Ветка не из этого исследования', [{ path: 'threadId', message: 'Ветка не найдена' }]);
  }
  const [row] = await ctx.db
    .insert(raItems)
    .values({
      workspaceId: ws.id,
      kind: input.kind,
      text: input.text,
      url: input.url ?? null,
      threadId: input.threadId ?? null,
      stance: input.kind === 'argument' ? (input.stance ?? 'for') : null,
      linkIds: input.linkIds,
      createdBy: p.id,
      createdAt: ctx.now,
    })
    .returning();
  return toItem(row!);
}

/** AI summary; regenerated only when the discussion or the board changed since the last one. */
export async function refreshSummary(ctx: Ctx, id: string) {
  const { ws } = await access(ctx, id);
  const [[lastMsg], [lastItem]] = await Promise.all([
    ctx.db.select({ at: max(raMessages.createdAt) }).from(raMessages).where(eq(raMessages.workspaceId, ws.id)),
    ctx.db.select({ at: max(raItems.createdAt) }).from(raItems).where(eq(raItems.workspaceId, ws.id)),
  ]);
  const latest = Math.max(lastMsg?.at?.getTime() ?? 0, lastItem?.at?.getTime() ?? 0);
  if (ws.summary && ws.summaryAt && ws.summaryAt.getTime() >= latest) return getWorkspace(ctx, id);

  const b = await loadBoard(ctx.db, ws);
  const messages = await ctx.db.select({ threadId: raMessages.threadId, text: raMessages.text }).from(raMessages).where(eq(raMessages.workspaceId, ws.id)).orderBy(asc(raMessages.createdAt)).limit(400);
  const out = await summarize(ctx.ai, { question: b.task.question, threads: b.threads, items: b.items, messages });
  const existing = new Set(b.items.filter((i) => i.kind === 'question').map((i) => i.text.trim().toLowerCase()));
  const summary: research.Summary = { ...out, missingQuestions: out.missingQuestions.filter((q) => !existing.has(q.trim().toLowerCase())), createdAt: iso(ctx.now) };
  await ctx.db.update(raWorkspaces).set({ summary, summaryAt: ctx.now }).where(eq(raWorkspaces.id, ws.id));
  return getWorkspace(ctx, id);
}

export async function submitConclusion(ctx: Ctx, id: string, input: z.infer<typeof research.ConclusionInput>) {
  const { ws, p } = await access(ctx, id, true);
  if (ws.status !== 'active') throw conflict('Вывод уже у преподавателя');
  const b = await loadBoard(ctx.db, ws);
  const errors = checkStatements(input.statements, new Map(b.items.map((i) => [i.id, { kind: i.kind }])));
  if (errors.length) throw invalid('Каждое утверждение опирается на аргумент или источник', errors);

  let assessment: research.Assessment | null = null;
  try {
    const out = await assessConclusion(ctx.ai, { task: b.task, initialPosition: ws.initialPosition, finalPosition: input.finalPosition, statements: input.statements, threads: b.threads, items: b.items });
    const finalTexts = [input.finalPosition, ...input.statements.map((s) => s.text)].join('\n');
    assessment = { ...out, growth: verifyGrowth(out.growth, ws.initialPosition, finalTexts) };
  } catch (err) {
    if (!(err instanceof AppError && err.code === 'ai_unavailable')) throw err;
  }

  await inTx(ctx, async (t) => {
    const [locked] = await t.db.select().from(raWorkspaces).where(eq(raWorkspaces.id, ws.id)).for('update').limit(1);
    if (locked!.status !== 'active') throw conflict('Вывод уже у преподавателя');
    const [{ v } = { v: 0 }] = await t.db.select({ v: sql<number>`coalesce(max(${raConclusions.version}), 0)::int` }).from(raConclusions).where(eq(raConclusions.workspaceId, ws.id));
    const [c] = await t.db
      .insert(raConclusions)
      .values({ workspaceId: ws.id, version: v + 1, finalPosition: input.finalPosition, statements: input.statements, assessment, createdBy: p.id, createdAt: t.now })
      .returning();
    const ev = await createEvidence(t, {
      module: MODULE,
      subjectType: SUBJECT.conclusion,
      subjectId: c!.id,
      teamId: ws.teamId,
      reviewerRole: 'teacher',
      kind: 'report',
      note: `${b.task.title}, вывод v${v + 1}`,
    });
    await t.db.update(raConclusions).set({ evidenceId: ev.id }).where(eq(raConclusions.id, c!.id));
    await t.db.update(raWorkspaces).set({ status: 'submitted' }).where(eq(raWorkspaces.id, ws.id));
  });
  return getWorkspace(ctx, id);
}

/** Conclusion behind a piece of evidence, for the teacher's review panel. */
export async function workspaceByEvidence(ctx: Ctx, evidenceId: string) {
  requireRole(ctx, 'teacher', 'student');
  const [c] = await ctx.db.select({ ws: raConclusions.workspaceId }).from(raConclusions).where(eq(raConclusions.evidenceId, evidenceId)).limit(1);
  if (!c) throw notFound('Вывод');
  return getWorkspace(ctx, c.ws);
}
