import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { DbLike } from '../platform/db/client.js';
import { refRoles, refSkills } from '../core/identity/schema.js';
import { refTaskTemplates } from '../modules/sprint/schema.js';
import { plModules, plQuestions } from '../modules/practice/schema.js';

export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../data');

export function readData<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8')) as T;
}

type SkillJson = { slug: string; title: string; category: string; difficulty: number };
type RoleJson = { slug: string; title: string; description: string };
type TemplateJson = { slug: string; title: string; stageKey: (typeof refTaskTemplates.$inferInsert)['stageKey']; defaultSkillSlug: string | null; description: string };

/** Справочники: навыки, роли, 25 типовых задач. Идемпотентно (upsert). */
export async function seedReferenceData(db: DbLike) {
  const skills = readData<SkillJson[]>('skills.json');
  const roles = readData<RoleJson[]>('roles.json');
  const templates = readData<TemplateJson[]>('task-templates.json');
  await db
    .insert(refSkills)
    .values(skills)
    .onConflictDoUpdate({ target: refSkills.slug, set: { title: sql`excluded.title`, category: sql`excluded.category`, difficulty: sql`excluded.difficulty` } });
  await db
    .insert(refRoles)
    .values(roles)
    .onConflictDoUpdate({ target: refRoles.slug, set: { title: sql`excluded.title`, description: sql`excluded.description` } });
  await db
    .insert(refTaskTemplates)
    .values(templates)
    .onConflictDoUpdate({
      target: refTaskTemplates.slug,
      set: { title: sql`excluded.title`, stageKey: sql`excluded.stage_key`, defaultSkillSlug: sql`excluded.default_skill_slug`, description: sql`excluded.description` },
    });
  const practice = await seedPracticeModules(db);
  return { skills: skills.length, roles: roles.length, templates: templates.length, practiceModules: practice };
}

type PracticeModuleJson = {
  slug: string;
  title: string;
  description: string;
  topics: string[];
  questions: { slug: string; topic: string; text: string; options: string[]; correct: number; explanation: string }[];
};

/** Practice Lab course modules and test questions (reference data, upsert by slug). */
async function seedPracticeModules(db: DbLike) {
  const mods = readData<PracticeModuleJson[]>('practice-modules.json');
  for (const [position, m] of mods.entries()) {
    const [row] = await db
      .insert(plModules)
      .values({ slug: m.slug, title: m.title, description: m.description, topics: m.topics, position })
      .onConflictDoUpdate({ target: plModules.slug, set: { title: m.title, description: m.description, topics: m.topics, position } })
      .returning({ id: plModules.id });
    await db
      .insert(plQuestions)
      .values(m.questions.map((q) => ({ ...q, moduleId: row!.id })))
      .onConflictDoUpdate({
        target: plQuestions.slug,
        set: { topic: sql`excluded.topic`, text: sql`excluded.text`, options: sql`excluded.options`, correct: sql`excluded.correct`, explanation: sql`excluded.explanation` },
      });
  }
  return mods.length;
}
