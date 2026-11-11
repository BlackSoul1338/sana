/**
 * Loads the learning catalog into an existing database without deleting anything:
 * reference data (upsert), then practice assignments and research tasks that are not there yet, authored by teachers.
 * Safe for production, unlike `seed`. Needs at least one teacher profile.
 */
import { createClient } from '@supabase/supabase-js';
import { asc, eq } from 'drizzle-orm';
import { env } from '../src/platform/env.js';
import { closeAllDb, createDb } from '../src/platform/db/client.js';
import { EventBus } from '../src/platform/events.js';
import { supabaseStorage } from '../src/platform/storage.js';
import type { Ctx } from '../src/platform/context.js';
import { profiles } from '../src/core/identity/schema.js';
import { registerModules } from '../src/modules/register.js';
import { seedReferenceData } from '../src/seed/refs.js';
import { seedPracticeAssignments, seedResearchTasks } from '../src/seed/content.js';

const e = env();
const { db } = createDb(e.DATABASE_URL);
const admin = createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const storage = supabaseStorage(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, e.EVIDENCE_BUCKET);
const bus = new EventBus();
registerModules(bus);

const teachers = await db.select().from(profiles).where(eq(profiles.role, 'teacher')).orderBy(asc(profiles.createdAt));
if (teachers.length === 0) throw new Error('No teacher profiles: create a teacher account first');
const emails = await Promise.all(teachers.map(async (t) => (await admin.auth.admin.getUserById(t.id)).data.user?.email ?? ''));

const author = (i: number): Ctx => {
  const t = teachers[i % teachers.length]!;
  return {
    db,
    actor: { userId: t.id, email: emails[i % teachers.length]!, profile: { id: t.id, role: t.role, orgId: t.orgId, displayName: t.displayName } },
    now: new Date(),
    ai: null,
    bus,
    storage,
  };
};

console.log('Справочники:', await seedReferenceData(db));
const assignments = await seedPracticeAssignments(db, author);
const tasks = await seedResearchTasks(db, author);
console.log(`Практические задания: добавлено ${assignments.size}`);
console.log(`Исследовательские задачи: всего ${tasks.size}`);
await closeAllDb();
