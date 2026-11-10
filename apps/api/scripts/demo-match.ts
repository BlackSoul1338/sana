/**
 * Демо Challenge Match на данных seed: рекомендации для команды и план роста.
 *   pnpm demo:match            — команда «Альфа»
 *   pnpm demo:match Каппа      — другая команда
 */
import { eq } from 'drizzle-orm';
import { env } from '../src/platform/env.js';
import { closeAllDb, createDb } from '../src/platform/db/client.js';
import { EventBus } from '../src/platform/events.js';
import { fakeStorage } from '../src/platform/storage.js';
import { profiles, teams } from '../src/core/identity/schema.js';
import { recommend } from '../src/modules/match/service.js';

const name = process.argv[2] ?? 'Альфа';
const { db } = createDb(env().DATABASE_URL);
try {
  const [team] = await db.select().from(teams).where(eq(teams.name, name)).limit(1);
  if (!team) throw new Error(`Команда «${name}» не найдена — запустите pnpm seed`);
  const [mentor] = await db.select().from(profiles).where(eq(profiles.role, 'mentor')).limit(1);
  const ctx = {
    db,
    actor: { userId: mentor!.id, email: null, profile: { id: mentor!.id, role: mentor!.role, orgId: null, displayName: mentor!.displayName } },
    now: new Date(),
    ai: null,
    bus: new EventBus(),
    storage: fakeStorage(),
  };
  const res = await recommend(ctx, { teamId: team.id, limit: 5 });
  console.log(`\nКоманда «${team.name}»: ${team.weeklyHours} ч/нед, интересы: ${team.interests.join(', ') || '—'}\n`);
  for (const [i, r] of res.items.entries()) {
    console.log(`${i + 1}. ${r.fit.score}%  ${r.title} — ${r.orgName} [${r.topic}, сложность ${r.difficulty}, ~${r.estHours} ч]`);
    for (const reason of r.fit.reasons) console.log(`     · ${reason}`);
  }
  console.log(`\nУровень команды: ${res.growth.teamLevel}. Чтобы брать задачи сложнее, добавьте навыки:`);
  for (const s of res.growth.skillsToAdd) console.log(`  + ${s.title}${s.unlocks ? ` — откроет ${s.unlocks} задач(и)` : ''}`);
} finally {
  await closeAllDb();
}
