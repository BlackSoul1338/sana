import type { Ctx } from '../platform/context.js';
import { plAssignments, plModules } from '../modules/practice/schema.js';
import * as practice from '../modules/practice/service.js';
import { raTasks } from '../modules/research/schema.js';
import * as research from '../modules/research/service.js';
import { readData } from './refs.js';

type PracticeAssignmentJson = { module: string; title: string; difficulty: number; condition: string; materials: string; criteria: { title: string; description: string; topic: string; maxPoints: number }[] };
type ResearchTaskJson = { title: string; question: string; context: string; rubric: Record<'argumentation' | 'completeness' | 'understanding' | 'originality', number> };

/** Teacher context for the i-th item of a catalog; the caller decides who authors it and when. */
type AuthorCtx = (index: number) => Ctx;

/**
 * Practice assignments from data/practice-assignments.json, authored by teachers.
 * Titles already in the database are skipped, so it is safe on a live database; returns only the created rows.
 */
export async function seedPracticeAssignments(db: Ctx['db'], author: AuthorCtx) {
  const [mods, existing] = await Promise.all([db.select().from(plModules), db.select({ title: plAssignments.title }).from(plAssignments)]);
  const modBySlug = new Map(mods.map((m) => [m.slug, m]));
  const have = new Set(existing.map((r) => r.title));
  const created = new Map<string, Awaited<ReturnType<typeof practice.createAssignment>>>();
  for (const [i, a] of readData<PracticeAssignmentJson[]>('practice-assignments.json').entries()) {
    if (have.has(a.title)) continue;
    const mod = modBySlug.get(a.module);
    if (!mod) throw new Error(`Practice module ${a.module} is missing: load reference data first`);
    created.set(a.title, await practice.createAssignment(author(i), { moduleId: mod.id, title: a.title, condition: a.condition, materials: a.materials, difficulty: a.difficulty, criteria: a.criteria }));
  }
  return created;
}

/** Research tasks from data/research-tasks.json; titles already present are kept. Returns ids by title, existing and new. */
export async function seedResearchTasks(db: Ctx['db'], author: AuthorCtx) {
  const ids = new Map((await db.select({ id: raTasks.id, title: raTasks.title }).from(raTasks)).map((r) => [r.title, r.id]));
  for (const [i, t] of readData<ResearchTaskJson[]>('research-tasks.json').entries()) {
    if (ids.has(t.title)) continue;
    const row = await research.createTask(author(i), {
      title: t.title,
      question: t.question,
      context: t.context,
      rubric: Object.entries(t.rubric).map(([key, maxPoints]) => ({ key: key as keyof ResearchTaskJson['rubric'], maxPoints, description: '' })),
    });
    ids.set(t.title, row.id);
  }
  return ids;
}
