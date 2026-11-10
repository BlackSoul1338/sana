import { and, eq } from 'drizzle-orm';
import type { Ctx } from '../../platform/context.js';
import type { DomainEvents, EventBus } from '../../platform/events.js';
import { award } from '../../core/points/ledger.js';
import { skillMap } from '../../core/identity/service.js';
import { awardsForApproval, type ApprovalFacts, type Tech } from './rules.js';
import { interviewCounts, refreshAchievements } from './service.js';
import { sprintProjects, sprintStages, sprintTasks } from './schema.js';
import { MODULE, STAGE_ORDER, SUBJECT } from './types.js';

/**
 * Решение куратора по подтверждению Sprint. Работает в транзакции проверки:
 * меняет статус этапа/задачи, собирает факты и пишет баллы через ledger.
 */
export async function onEvidenceReviewed(ctx: Ctx, e: DomainEvents['evidence.reviewed']) {
  const ev = e.evidence;
  if (ev.module !== MODULE) return;
  const approved = e.decision !== 'reject';

  let projectId: string;
  let stage: ApprovalFacts['stage'];
  let task: ApprovalFacts['task'];

  if (ev.subjectType === SUBJECT.stage) {
    const [row] = await ctx.db.select().from(sprintStages).where(eq(sprintStages.id, ev.subjectId)).limit(1);
    if (!row) return;
    projectId = row.projectId;
    await ctx.db
      .update(sprintStages)
      .set(approved ? { status: 'approved', completedAt: ev.createdAt } : { status: 'rejected' })
      .where(eq(sprintStages.id, row.id));
    stage = { key: row.stageKey, plannedAt: row.plannedAt };
  } else if (ev.subjectType === SUBJECT.task) {
    const [row] = await ctx.db.select().from(sprintTasks).where(eq(sprintTasks.id, ev.subjectId)).limit(1);
    if (!row) return;
    projectId = row.projectId;
    await ctx.db.update(sprintTasks).set({ status: approved ? 'done' : 'in_progress' }).where(eq(sprintTasks.id, row.id));
    const skills = await skillMap(ctx.db);
    const s = row.skillSlug ? skills.get(row.skillSlug) : undefined;
    task = { id: row.id, title: row.title, assigneeId: row.assigneeId, skill: s && row.skillSlug ? { slug: row.skillSlug, title: s.title, difficulty: s.difficulty } : null };
  } else if (ev.subjectType === SUBJECT.interview) {
    projectId = ev.subjectId;
  } else {
    return;
  }

  if (!approved) return;

  const [project] = await ctx.db.select().from(sprintProjects).where(eq(sprintProjects.id, projectId)).limit(1);
  if (!project) return;

  const stages = await ctx.db.select().from(sprintStages).where(eq(sprintStages.projectId, projectId));
  const prototypeApproved = stages.some((s) => s.stageKey === 'prototype' && s.status === 'approved');
  const facts: ApprovalFacts = {
    evidence: { id: ev.id, kind: ev.kind, url: ev.url, submittedAt: ev.createdAt, submittedBy: ev.submittedBy },
    project: { id: project.id, teamId: project.teamId },
    ...(stage ? { stage } : {}),
    ...(task ? { task } : {}),
    interviewsCounted: (await interviewCounts(ctx.db, projectId, ev.id)).approved,
    techUsed: stage?.key === 'prototype' ? await doneTech(ctx, projectId) : [],
    prototypeApproved: prototypeApproved && stage?.key !== 'prototype',
  };

  await award(ctx.db, awardsForApproval(facts).map((a) => ({ ...a, actorId: e.reviewerId })));
  await refreshAchievements(ctx, projectId, ev.id);

  if (STAGE_ORDER.every((k) => stages.find((s) => s.stageKey === k)?.status === 'approved')) {
    await ctx.db.update(sprintProjects).set({ status: 'completed' }).where(eq(sprintProjects.id, projectId));
  }
}

async function doneTech(ctx: Ctx, projectId: string): Promise<Tech[]> {
  const rows = await ctx.db
    .select({ slug: sprintTasks.skillSlug })
    .from(sprintTasks)
    .where(and(eq(sprintTasks.projectId, projectId), eq(sprintTasks.status, 'done')));
  const skills = await skillMap(ctx.db);
  return rows
    .map((r) => (r.slug ? { slug: r.slug, ...skills.get(r.slug)! } : null))
    .filter((t): t is Tech & { category: string } => !!t && t.difficulty !== undefined)
    .map(({ slug, title, difficulty }) => ({ slug, title, difficulty }));
}

export function registerSprintHandlers(bus: EventBus) {
  bus.on('evidence.reviewed', onEvidenceReviewed);
}
