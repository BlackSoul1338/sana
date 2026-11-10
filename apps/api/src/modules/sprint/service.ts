import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { sprint } from '@sana/contracts';
import { inTx, requireProfile, requireRole, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso, isoOrNull } from '../../platform/db/columns.js';
import { conflict, forbidden, invalid, notFound } from '../../platform/errors.js';
import { generateStructured } from '../../platform/ai/index.js';
import { isTeamMember, requireTeamAccess, skillMap, teamIdsOf, teamMemberIds, teamNames } from '../../core/identity/service.js';
import { findAssignment, findTask } from '../../core/catalog/service.js';
import { createEvidence, evidenceForTeam, isApprovedStatus, toEvidence } from '../../core/evidence/service.js';
import { eventsForSubjects, existsKey, totalFor } from '../../core/points/ledger.js';
import { evidence } from '../../core/evidence/schema.js';
import { ACHIEVEMENTS, earnedAchievements, type AchievementCode } from './achievements.js';
import { chooseNextStep, currentStage, templateText } from './next-step.js';
import { STAGE_PLAN_OFFSET_DAYS } from './points.config.js';
import { NEXT_STEP_SYSTEM, NextStepPhrase, nextStepPrompt } from './prompts.js';
import { refTaskTemplates, sprintAchievements, sprintProjects, sprintStages, sprintTasks } from './schema.js';
import { MODULE, STAGE_ORDER, SUBJECT, type StageKey } from './types.js';

type ProjectRow = typeof sprintProjects.$inferSelect;
type StageRow = typeof sprintStages.$inferSelect;
type TaskRow = typeof sprintTasks.$inferSelect;

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// ---------- доступ ----------

type Access = { project: ProjectRow; level: 'team' | 'mentor' | 'business' };

/** Участник команды и куратор видят всё; бизнес — только проект по своей задаче и только подтверждённое. */
async function projectAccess(ctx: Ctx, projectId: string): Promise<Access> {
  const p = requireProfile(ctx);
  const [project] = await ctx.db.select().from(sprintProjects).where(eq(sprintProjects.id, projectId)).limit(1);
  if (!project) throw notFound('Проект');
  if (p.role === 'mentor') return { project, level: 'mentor' };
  if (p.role === 'student' && (await isTeamMember(ctx.db, project.teamId, p.id))) return { project, level: 'team' };
  if (p.role === 'business' && project.assignmentId && p.orgId) {
    const a = await findAssignment(ctx.db, project.assignmentId);
    const task = a ? await findTask(ctx.db, a.taskId) : undefined;
    if (task?.ownerOrgId === p.orgId) return { project, level: 'business' };
  }
  throw forbidden('Проект доступен команде, куратору и бизнесу-заказчику');
}

async function requireTeamWrite(ctx: Ctx, projectId: string): Promise<ProjectRow> {
  const a = await projectAccess(ctx, projectId);
  if (a.level === 'business') throw forbidden('Бизнес только просматривает подтверждённый прогресс');
  return a.project;
}

// ---------- чтение ----------

async function loadStages(db: DbLike, projectId: string): Promise<StageRow[]> {
  return db.select().from(sprintStages).where(eq(sprintStages.projectId, projectId)).orderBy(asc(sprintStages.order));
}

function stageDto(stages: StageRow[]) {
  const cur = currentStage(stages.map((s) => ({ key: s.stageKey, status: s.status, plannedAt: s.plannedAt })));
  return stages.map((s) => ({
    key: s.stageKey,
    order: s.order,
    status: s.status,
    plannedAt: s.plannedAt,
    completedAt: isoOrNull(s.completedAt),
    isCurrent: cur?.key === s.stageKey,
  }));
}

const taskDto = (t: TaskRow) => ({
  id: t.id,
  projectId: t.projectId,
  templateSlug: t.templateSlug,
  title: t.title,
  stageKey: t.stageKey,
  assigneeId: t.assigneeId,
  skillSlug: t.skillSlug,
  status: t.status,
  createdAt: iso(t.createdAt),
});

async function projectSubjectIds(db: DbLike, projectId: string) {
  const [stages, tasks] = await Promise.all([
    db.select({ id: sprintStages.id }).from(sprintStages).where(eq(sprintStages.projectId, projectId)),
    db.select({ id: sprintTasks.id }).from(sprintTasks).where(eq(sprintTasks.projectId, projectId)),
  ]);
  return [projectId, ...stages.map((s) => s.id), ...tasks.map((t) => t.id)];
}

export async function getProject(ctx: Ctx, projectId: string): Promise<sprint.Project> {
  const { project, level } = await projectAccess(ctx, projectId);
  const [stages, tasks, names, assignment] = await Promise.all([
    loadStages(ctx.db, projectId),
    ctx.db.select().from(sprintTasks).where(eq(sprintTasks.projectId, projectId)).orderBy(asc(sprintTasks.createdAt)),
    teamNames(ctx.db, [project.teamId]),
    project.assignmentId ? findAssignment(ctx.db, project.assignmentId) : Promise.resolve(undefined),
  ]);
  const subjectIds = new Set(await projectSubjectIds(ctx.db, projectId));
  const allEvidence = (await evidenceForTeam(ctx.db, project.teamId, MODULE)).filter((e) => subjectIds.has(e.subjectId));
  const visible = level === 'business' ? allEvidence.filter((e) => isApprovedStatus(e.status)) : allEvidence;
  const members = await teamMemberIds(ctx.db, project.teamId);
  const byMember: Record<string, number> = {};
  for (const m of members) byMember[m] = await totalFor(ctx.db, 'profile', m, MODULE);
  return {
    id: project.id,
    teamId: project.teamId,
    teamName: names.get(project.teamId) ?? '—',
    title: project.title,
    idea: project.idea,
    assignmentId: project.assignmentId,
    challengeTaskId: assignment?.taskId ?? null,
    status: project.status,
    stages: stageDto(stages),
    tasks: tasks.map(taskDto),
    evidence: visible.map(toEvidence),
    points: { team: await totalFor(ctx.db, 'team', project.teamId), byMember },
    createdAt: iso(project.createdAt),
  };
}

export async function listProjects(ctx: Ctx, q: { teamId?: string | undefined }): Promise<sprint.ProjectSummary[]> {
  const p = requireProfile(ctx);
  let rows: ProjectRow[];
  if (p.role === 'mentor') {
    rows = await ctx.db.select().from(sprintProjects).where(q.teamId ? eq(sprintProjects.teamId, q.teamId) : undefined).orderBy(desc(sprintProjects.createdAt));
  } else if (p.role === 'student') {
    const mine = await teamIdsOf(ctx.db, p.id);
    const ids = q.teamId ? mine.filter((t) => t === q.teamId) : mine;
    rows = ids.length ? await ctx.db.select().from(sprintProjects).where(inArray(sprintProjects.teamId, ids)).orderBy(desc(sprintProjects.createdAt)) : [];
  } else {
    // Бизнес видит проекты по задачам своей организации.
    const res = await ctx.db.execute<{ id: string }>(sql`
      select sp.id from sprint_projects sp
      join assignments a on a.id = sp.assignment_id
      join tasks t on t.id = a.task_id
      where t.owner_org_id = ${p.orgId}
    `);
    const ids = [...res].map((r) => r.id);
    rows = ids.length ? await ctx.db.select().from(sprintProjects).where(inArray(sprintProjects.id, ids)) : [];
  }
  const names = await teamNames(ctx.db, [...new Set(rows.map((r) => r.teamId))]);
  return Promise.all(
    rows.map(async (r) => {
      const stages = await loadStages(ctx.db, r.id);
      const cur = currentStage(stages.map((s) => ({ key: s.stageKey, status: s.status, plannedAt: s.plannedAt })));
      const a = r.assignmentId ? await findAssignment(ctx.db, r.assignmentId) : undefined;
      return {
        id: r.id,
        teamId: r.teamId,
        teamName: names.get(r.teamId) ?? '—',
        title: r.title,
        currentStage: cur?.key ?? null,
        approvedStages: stages.filter((s) => s.status === 'approved').length,
        challengeTaskId: a?.taskId ?? null,
      };
    }),
  );
}

export async function listTemplates(ctx: Ctx): Promise<sprint.TaskTemplate[]> {
  requireProfile(ctx);
  const rows = await ctx.db.select().from(refTaskTemplates).orderBy(asc(refTaskTemplates.stageKey), asc(refTaskTemplates.slug));
  return rows.sort((a, b) => STAGE_ORDER.indexOf(a.stageKey) - STAGE_ORDER.indexOf(b.stageKey));
}

// ---------- изменения ----------

export async function createProject(ctx: Ctx, input: z.infer<typeof sprint.CreateProjectInput>, opts: { assignmentId?: string } = {}) {
  const p = requireRole(ctx, 'student', 'mentor');
  await requireTeamAccess(ctx, input.teamId);
  const start = input.startDate ?? ctx.now.toISOString().slice(0, 10);
  const id = await inTx(ctx, async (t) => {
    const [project] = await t.db
      .insert(sprintProjects)
      .values({ teamId: input.teamId, title: input.title, idea: input.idea, createdBy: p.id, assignmentId: opts.assignmentId ?? null })
      .returning();
    await t.db.insert(sprintStages).values(
      STAGE_ORDER.map((key, i) => ({ projectId: project!.id, stageKey: key, order: i + 1, plannedAt: addDays(start, STAGE_PLAN_OFFSET_DAYS[key]) })),
    );
    return project!.id;
  });
  return getProject(ctx, id);
}

/** Привязка проекта к закреплённой задаче бизнеса (вызывается сценарием принятия заявки). */
export async function linkAssignment(ctx: Ctx, input: { teamId: string; assignmentId: string; taskTitle: string; taskSummary: string }) {
  const [existing] = await ctx.db
    .select()
    .from(sprintProjects)
    .where(and(eq(sprintProjects.teamId, input.teamId), eq(sprintProjects.status, 'active'), sql`${sprintProjects.assignmentId} is null`))
    .orderBy(desc(sprintProjects.createdAt))
    .limit(1);
  if (existing) {
    await ctx.db.update(sprintProjects).set({ assignmentId: input.assignmentId }).where(eq(sprintProjects.id, existing.id));
    await refreshAchievements(ctx, existing.id);
    return { projectId: existing.id, created: false };
  }
  const start = ctx.now.toISOString().slice(0, 10);
  const [project] = await ctx.db
    .insert(sprintProjects)
    .values({
      teamId: input.teamId,
      title: input.taskTitle,
      idea: input.taskSummary || input.taskTitle,
      assignmentId: input.assignmentId,
      createdBy: ctx.actor.profile?.id ?? null,
    })
    .returning();
  await ctx.db.insert(sprintStages).values(
    STAGE_ORDER.map((key, i) => ({ projectId: project!.id, stageKey: key, order: i + 1, plannedAt: addDays(start, STAGE_PLAN_OFFSET_DAYS[key]) })),
  );
  await refreshAchievements(ctx, project!.id);
  return { projectId: project!.id, created: true };
}

export async function updateStagePlan(ctx: Ctx, projectId: string, stageKey: StageKey, plannedAt: string) {
  requireRole(ctx, 'mentor');
  const updated = await ctx.db
    .update(sprintStages)
    .set({ plannedAt })
    .where(and(eq(sprintStages.projectId, projectId), eq(sprintStages.stageKey, stageKey)))
    .returning();
  if (!updated.length) throw notFound('Этап');
  return getProject(ctx, projectId);
}

async function assertSkill(db: DbLike, slug: string | null | undefined) {
  if (!slug) return;
  if (!(await skillMap(db)).has(slug)) throw invalid('Неизвестная технология', [{ path: 'skillSlug', message: 'Нет в справочнике' }]);
}

async function assertAssignee(db: DbLike, teamId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  if (!(await isTeamMember(db, teamId, assigneeId))) throw invalid('Исполнитель должен быть участником команды', [{ path: 'assigneeId', message: 'Не участник' }]);
}

export async function createTask(ctx: Ctx, projectId: string, input: z.infer<typeof sprint.CreateSprintTaskInput>) {
  const project = await requireTeamWrite(ctx, projectId);
  let title = input.title;
  let stageKey = input.stageKey;
  let skillSlug = input.skillSlug ?? null;
  if (input.templateSlug) {
    const [tpl] = await ctx.db.select().from(refTaskTemplates).where(eq(refTaskTemplates.slug, input.templateSlug)).limit(1);
    if (!tpl) throw invalid('Неизвестный шаблон задачи', [{ path: 'templateSlug', message: 'Нет в справочнике' }]);
    title ??= tpl.title;
    stageKey ??= tpl.stageKey;
    if (input.skillSlug === undefined) skillSlug = tpl.defaultSkillSlug;
  }
  await assertSkill(ctx.db, skillSlug);
  await assertAssignee(ctx.db, project.teamId, input.assigneeId);
  const [row] = await ctx.db
    .insert(sprintTasks)
    .values({ projectId, templateSlug: input.templateSlug ?? null, title: title!, stageKey: stageKey!, skillSlug, assigneeId: input.assigneeId ?? null })
    .returning();
  return taskDto(row!);
}

export async function updateTask(ctx: Ctx, taskId: string, input: z.infer<typeof sprint.UpdateSprintTaskInput>) {
  const [task] = await ctx.db.select().from(sprintTasks).where(eq(sprintTasks.id, taskId)).limit(1);
  if (!task) throw notFound('Задача проекта');
  const project = await requireTeamWrite(ctx, task.projectId);
  if (task.status === 'submitted' || task.status === 'done') throw conflict('Задача уже сдана на проверку или подтверждена');
  if (input.skillSlug !== undefined) await assertSkill(ctx.db, input.skillSlug);
  if (input.assigneeId !== undefined) await assertAssignee(ctx.db, project.teamId, input.assigneeId);
  const patch: Partial<typeof sprintTasks.$inferInsert> = {};
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
  if (input.skillSlug !== undefined) patch.skillSlug = input.skillSlug;
  if (input.status !== undefined) patch.status = input.status;
  const [row] = Object.keys(patch).length
    ? await ctx.db.update(sprintTasks).set(patch).where(eq(sprintTasks.id, taskId)).returning()
    : [task];
  return taskDto(row!);
}

/**
 * Подтверждение от участника. Этап можно сдать только текущий и только один раз до решения куратора;
 * интервью можно добавлять отдельно, этап они не закрывают.
 */
export async function submitEvidence(ctx: Ctx, projectId: string, input: z.infer<typeof sprint.SubmitSprintEvidenceInput>) {
  const p = requireRole(ctx, 'student');
  const project = await requireTeamWrite(ctx, projectId);
  if (!(await isTeamMember(ctx.db, project.teamId, p.id))) throw forbidden('Подтверждение отправляет участник команды');
  if (project.status !== 'active') throw conflict('Проект не активен');

  return inTx(ctx, async (t) => {
    let subjectType: string;
    let subjectId: string;
    if (input.target === 'stage') {
      const stages = await t.db.select().from(sprintStages).where(eq(sprintStages.projectId, projectId)).orderBy(asc(sprintStages.order)).for('update');
      const cur = currentStage(stages.map((s) => ({ key: s.stageKey, status: s.status, plannedAt: s.plannedAt })));
      const stage = stages.find((s) => s.stageKey === input.stageKey)!;
      if (stage.status === 'approved') throw conflict('Этап уже подтверждён');
      if (stage.status === 'submitted') throw conflict('Этап уже на проверке у куратора');
      if (cur?.key !== input.stageKey) throw conflict(`Сейчас открыт этап «${cur?.key}», этапы проходятся по порядку`, { currentStage: cur?.key });
      await t.db.update(sprintStages).set({ status: 'submitted' }).where(eq(sprintStages.id, stage.id));
      subjectType = SUBJECT.stage;
      subjectId = stage.id;
    } else if (input.target === 'task') {
      const [task] = await t.db.select().from(sprintTasks).where(and(eq(sprintTasks.id, input.taskId!), eq(sprintTasks.projectId, projectId))).for('update').limit(1);
      if (!task) throw notFound('Задача проекта');
      if (task.status === 'submitted' || task.status === 'done') throw conflict('Задача уже сдана на проверку или подтверждена');
      await t.db.update(sprintTasks).set({ status: 'submitted' }).where(eq(sprintTasks.id, task.id));
      subjectType = SUBJECT.task;
      subjectId = task.id;
    } else {
      subjectType = SUBJECT.interview;
      subjectId = projectId;
    }
    const row = await createEvidence(t, {
      module: MODULE,
      subjectType,
      subjectId,
      teamId: project.teamId,
      kind: input.kind,
      url: input.url,
      storagePath: input.storagePath,
      note: input.note,
    });
    return toEvidence(row);
  });
}

// ---------- лента, достижения, следующий шаг ----------

export async function interviewCounts(db: DbLike, projectId: string, excludeEvidenceId?: string) {
  const subjectIds = await projectSubjectIds(db, projectId);
  const rows = await db
    .select({ status: evidence.status, n: sql<number>`count(*)::int` })
    .from(evidence)
    .where(
      and(
        eq(evidence.module, MODULE),
        eq(evidence.kind, 'interview'),
        inArray(evidence.subjectId, subjectIds),
        excludeEvidenceId ? ne(evidence.id, excludeEvidenceId) : undefined,
      ),
    )
    .groupBy(evidence.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return { approved: (by.approved ?? 0) + (by.adjusted ?? 0), pending: by.pending ?? 0 };
}

async function hasWorkingPrototype(db: DbLike, projectId: string) {
  return existsKey(db, `sprint:prototype:${projectId}`);
}

export async function refreshAchievements(ctx: Ctx, projectId: string, evidenceId?: string) {
  const [project] = await ctx.db.select().from(sprintProjects).where(eq(sprintProjects.id, projectId)).limit(1);
  if (!project) return;
  const stages = await loadStages(ctx.db, projectId);
  const interviews = await interviewCounts(ctx.db, projectId);
  const codes = earnedAchievements({
    approvedStages: stages.filter((s) => s.status === 'approved').map((s) => s.stageKey),
    approvedInterviews: interviews.approved,
    hasWorkingPrototype: await hasWorkingPrototype(ctx.db, projectId),
    linkedToBusinessTask: !!project.assignmentId,
  });
  if (codes.length) {
    await ctx.db
      .insert(sprintAchievements)
      .values(codes.map((code) => ({ teamId: project.teamId, projectId, code, evidenceId: evidenceId ?? null, earnedAt: ctx.now })))
      .onConflictDoNothing();
  }
}

export async function getFeed(ctx: Ctx, projectId: string): Promise<sprint.Feed> {
  const { project } = await projectAccess(ctx, projectId);
  const members = await teamMemberIds(ctx.db, project.teamId);
  const [events, achievements] = await Promise.all([
    eventsForSubjects(ctx.db, [project.teamId, ...members]),
    ctx.db.select().from(sprintAchievements).where(eq(sprintAchievements.projectId, projectId)).orderBy(desc(sprintAchievements.earnedAt)),
  ]);
  const ach = achievements.map((a) => ({ code: a.code, title: ACHIEVEMENTS[a.code as AchievementCode] ?? a.code, earnedAt: iso(a.earnedAt) }));
  const items = [
    ...events
      .filter((e) => e.subjectType === 'team' || e.subjectType === 'profile')
      .map((e) => ({
        type: 'points' as const,
        at: iso(e.createdAt),
        title: e.ruleId,
        points: e.points,
        explanation: e.explanation,
        subjectType: e.subjectType as 'team' | 'profile',
        subjectId: e.subjectId,
      })),
    ...ach.map((a) => ({
      type: 'achievement' as const,
      at: a.earnedAt,
      title: a.title,
      points: null,
      explanation: `Достижение: ${a.title}`,
      subjectType: 'team' as const,
      subjectId: project.teamId,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { items, achievements: ach };
}

export async function getNextStep(ctx: Ctx, projectId: string): Promise<sprint.NextStep | null> {
  const project = await requireTeamWrite(ctx, projectId);
  const stages = await loadStages(ctx.db, projectId);
  const interviews = await interviewCounts(ctx.db, projectId);
  const choice = chooseNextStep({
    stages: stages.map((s) => ({ key: s.stageKey, status: s.status, plannedAt: s.plannedAt })),
    approvedInterviews: interviews.approved,
    pendingInterviews: interviews.pending,
    hasWorkingPrototype: await hasWorkingPrototype(ctx.db, projectId),
    now: ctx.now,
  });
  if (!choice) return null;
  if (!ctx.ai) return { ...choice, text: templateText(choice), generatedBy: 'template' };
  try {
    const out = await generateStructured({
      models: ctx.ai,
      tier: 'fast',
      schema: NextStepPhrase,
      system: NEXT_STEP_SYSTEM,
      prompt: nextStepPrompt({ idea: project.idea, action: choice.action, points: choice.potentialPoints }),
      maxOutputTokens: 1024,
      schemaRetries: 0,
      timeoutMs: 20_000,
    });
    return { ...choice, text: out.text.trim() || templateText(choice), generatedBy: 'ai' };
  } catch {
    return { ...choice, text: templateText(choice), generatedBy: 'template' };
  }
}
