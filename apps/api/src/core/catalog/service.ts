import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import type { z } from 'zod';
import type { Assignment, Task, TaskCard, TaskListQuery, TaskRequirements } from '@sana/contracts';
import { requireProfile, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso, isoOrNull } from '../../platform/db/columns.js';
import { conflict, forbidden, invalid, notFound } from '../../platform/errors.js';
import { orgs } from '../identity/schema.js';
import { skillMap } from '../identity/service.js';
import { assignments, tasks, taskSkills } from './schema.js';

type TaskRow = typeof tasks.$inferSelect;
type AssignmentRow = typeof assignments.$inferSelect;

export const toAssignment = (r: AssignmentRow): Assignment => ({
  id: r.id,
  taskId: r.taskId,
  teamId: r.teamId,
  source: r.source,
  status: r.status,
  createdAt: iso(r.createdAt),
});

async function hydrate(db: DbLike, rows: TaskRow[]): Promise<Task[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const orgIds = [...new Set(rows.map((r) => r.ownerOrgId))];
  const [skills, orgRows] = await Promise.all([
    db.select().from(taskSkills).where(inArray(taskSkills.taskId, ids)).orderBy(desc(taskSkills.required), asc(taskSkills.skillSlug)),
    db.select({ id: orgs.id, name: orgs.name }).from(orgs).where(inArray(orgs.id, orgIds)),
  ]);
  const orgName = new Map(orgRows.map((o) => [o.id, o.name]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    ownerOrgId: r.ownerOrgId,
    ownerOrgName: orgName.get(r.ownerOrgId) ?? '—',
    status: r.status,
    title: r.title,
    summary: r.summary,
    readiness: r.readiness,
    topic: r.topic,
    difficulty: r.difficulty,
    estHours: r.estHours,
    skills: skills.filter((s) => s.taskId === r.id).map((s) => ({ slug: s.skillSlug, required: s.required })),
    card: ((r.payload as { card?: TaskCard }).card ?? null) as TaskCard | null,
    publishedAt: isoOrNull(r.publishedAt),
    createdAt: iso(r.createdAt),
  }));
}

const decodeCursor = (c?: string) => (c ? Math.max(0, Number.parseInt(Buffer.from(c, 'base64url').toString(), 10) || 0) : 0);
const encodeCursor = (offset: number) => Buffer.from(String(offset)).toString('base64url');

/** Каталог: опубликованные задачи по убыванию готовности. Готовность повышает видимость, но не выбор. */
export async function listTasks(ctx: Ctx, q: z.infer<typeof TaskListQuery>) {
  const p = requireProfile(ctx);
  const mine = q.mine === 'true';
  if (mine && (p.role !== 'business' || !p.orgId)) throw forbidden('Фильтр mine доступен представителю бизнеса');
  const offset = decodeCursor(q.cursor);
  const rows = await ctx.db
    .select()
    .from(tasks)
    .where(
      and(
        mine ? eq(tasks.ownerOrgId, p.orgId!) : eq(tasks.status, 'published'),
        q.topic ? eq(tasks.topic, q.topic.trim().toLowerCase()) : undefined,
        q.difficulty ? eq(tasks.difficulty, q.difficulty) : undefined,
      ),
    )
    .orderBy(desc(tasks.readiness), desc(tasks.createdAt), asc(tasks.id))
    .limit(q.limit + 1)
    .offset(offset);
  const page = rows.slice(0, q.limit);
  return { items: await hydrate(ctx.db, page), nextCursor: rows.length > q.limit ? encodeCursor(offset + q.limit) : null };
}

export async function getTask(ctx: Ctx, id: string): Promise<Task> {
  const p = requireProfile(ctx);
  const [row] = await ctx.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) throw notFound('Задача');
  if (row.status !== 'published' && row.ownerOrgId !== p.orgId && p.role !== 'mentor') throw notFound('Задача');
  return (await hydrate(ctx.db, [row]))[0]!;
}

export async function findTask(db: DbLike, id: string): Promise<TaskRow | undefined> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row;
}

export async function tasksByIds(db: DbLike, ids: string[]): Promise<Task[]> {
  if (!ids.length) return [];
  return hydrate(db, await db.select().from(tasks).where(inArray(tasks.id, ids)));
}

/** Опубликованные задачи с требованиями — вход для подбора команд. */
export async function publishedTasks(db: DbLike, filters: { topic?: string | undefined; difficulty?: number | undefined }): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.status, 'published'),
        filters.topic ? eq(tasks.topic, filters.topic.trim().toLowerCase()) : undefined,
        filters.difficulty ? eq(tasks.difficulty, filters.difficulty) : undefined,
      ),
    );
  return hydrate(db, rows);
}

export async function validateRequirements(db: DbLike, req: TaskRequirements) {
  const known = await skillMap(db);
  const unknown = req.skills.filter((s) => !known.has(s.slug));
  if (unknown.length) {
    throw invalid('Неизвестные навыки в требованиях', unknown.map((s) => ({ path: `requirements.skills.${s.slug}`, message: 'Нет в справочнике' })));
  }
  if (!req.skills.some((s) => s.required)) {
    throw invalid('Нужен хотя бы один обязательный навык', [{ path: 'requirements.skills', message: 'Нет обязательных навыков' }]);
  }
}

/** Публикация задачи в каталог. Вызывается модулем после ручного подтверждения бизнесом. */
export async function publishTask(
  ctx: Ctx,
  input: {
    ownerOrgId: string;
    title: string;
    summary: string;
    readiness: number;
    requirements: TaskRequirements;
    card: TaskCard;
    sourceRef: string;
    createdBy: string;
  },
): Promise<TaskRow> {
  await validateRequirements(ctx.db, input.requirements);
  const [row] = await ctx.db
    .insert(tasks)
    .values({
      kind: 'business_challenge',
      ownerOrgId: input.ownerOrgId,
      status: 'published',
      title: input.title,
      summary: input.summary,
      readiness: Math.max(0, Math.min(100, Math.round(input.readiness))),
      topic: input.requirements.topic.trim().toLowerCase(),
      difficulty: input.requirements.difficulty,
      estHours: input.requirements.estHours,
      payload: { card: input.card },
      sourceRef: input.sourceRef,
      createdBy: input.createdBy,
      publishedAt: ctx.now,
    })
    .returning();
  const unique = new Map(input.requirements.skills.map((s) => [s.slug, s.required]));
  await ctx.db.insert(taskSkills).values([...unique].map(([skillSlug, required]) => ({ taskId: row!.id, skillSlug, required })));
  return row!;
}

/**
 * Закрепление задачи за командой — только после подтверждения обеими сторонами (это проверяет вызывающий сценарий).
 * Шлёт assignment.created в транзакции вызывающего.
 */
export async function createAssignment(ctx: Ctx, input: { taskId: string; teamId: string; source: AssignmentRow['source'] }): Promise<AssignmentRow> {
  const task = await findTask(ctx.db, input.taskId);
  if (!task || task.status !== 'published') throw conflict('Задача не опубликована');
  const [existing] = await ctx.db
    .select()
    .from(assignments)
    .where(and(eq(assignments.taskId, input.taskId), eq(assignments.teamId, input.teamId)))
    .limit(1);
  if (existing && existing.status === 'active') throw conflict('Задача уже закреплена за командой');
  const [row] = existing
    ? await ctx.db.update(assignments).set({ status: 'active', source: input.source }).where(eq(assignments.id, existing.id)).returning()
    : await ctx.db.insert(assignments).values(input).returning();
  await ctx.bus.emit(ctx, 'assignment.created', { assignmentId: row!.id, taskId: row!.taskId, teamId: row!.teamId });
  return row!;
}

export async function findAssignment(db: DbLike, id: string): Promise<AssignmentRow | undefined> {
  const [row] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  return row;
}

export async function activeAssignments(db: DbLike, by: { teamId?: string; taskId?: string }): Promise<AssignmentRow[]> {
  return db
    .select()
    .from(assignments)
    .where(
      and(
        ne(assignments.status, 'cancelled'),
        by.teamId ? eq(assignments.teamId, by.teamId) : undefined,
        by.taskId ? eq(assignments.taskId, by.taskId) : undefined,
      ),
    )
    .orderBy(desc(assignments.createdAt));
}
