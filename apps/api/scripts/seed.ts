/**
 * Синтетические данные для демо: справочники, 7 компаний, 20 команд (50 студентов), 30 задач бизнеса,
 * 10 проектов Startup Sprint на разных этапах, заявки Challenge Match и отзывы бизнеса.
 * Всё, что влияет на баллы, проходит через сервисы и ledger — как в реальной работе.
 *
 *   pnpm seed            — только локальный Supabase (127.0.0.1/localhost)
 *   pnpm seed --force    — разрешить другой хост (осторожно: удаляет данные)
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { sql } from 'drizzle-orm';
import { env } from '../src/platform/env.js';
import { closeAllDb, createDb } from '../src/platform/db/client.js';
import { EventBus } from '../src/platform/events.js';
import { supabaseStorage } from '../src/platform/storage.js';
import type { Ctx } from '../src/platform/context.js';
import { orgs, profiles, teamMembers, teams, teamSkills } from '../src/core/identity/schema.js';
import { publishTask } from '../src/core/catalog/service.js';
import { reviewEvidence } from '../src/core/evidence/service.js';
import { registerModules } from '../src/modules/register.js';
import * as sprint from '../src/modules/sprint/service.js';
import * as match from '../src/modules/match/service.js';
import { decideApplication } from '../src/flows/accept-application.js';
import { DATA_DIR, readData, seedReferenceData } from '../src/seed/refs.js';
import { STAGE_ORDER, type StageKey } from '../src/modules/sprint/types.js';
import { STAGE_PLAN_OFFSET_DAYS } from '../src/modules/sprint/points.config.js';

type Role = 'student' | 'mentor' | 'business' | 'teacher';
type User = { id: string; email: string; name: string; role: Role; orgId: string | null };

type TasksJson = {
  orgs: { key: string; name: string; topic: string }[];
  tasks: {
    org: string;
    title: string;
    topic: string;
    difficulty: number;
    estHours: number;
    readiness: number;
    skills: { slug: string; required: boolean }[];
    card: Record<'context' | 'goal' | 'users' | 'data' | 'constraints' | 'criteria', string>;
  }[];
};
type TeamsJson = { name: string; weeklyHours: number; interests: string[]; skills: { slug: string; level: number }[]; members: { name: string; role: string }[] }[];

const e = env();
const force = process.argv.includes('--force');
const host = new URL(e.SUPABASE_URL).hostname;
if (!['127.0.0.1', 'localhost'].includes(host) && !force) {
  console.error(`Seed удаляет все данные. Хост ${host} не локальный — добавьте --force, если уверены.`);
  process.exit(1);
}

const { db } = createDb(e.DATABASE_URL);
const admin = createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const storage = supabaseStorage(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, e.EVIDENCE_BUCKET);
const bus = new EventBus();
registerModules(bus);
const PASSWORD = `sana-${randomBytes(4).toString('hex')}`;

const DAY = 86_400_000;
const today = new Date();
today.setUTCHours(9, 0, 0, 0);
const at = (base: Date, days: number, hours = 0) => new Date(base.getTime() + days * DAY + hours * 3_600_000);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

function ctxFor(user: User, now: Date): Ctx {
  return {
    db,
    actor: { userId: user.id, email: user.email, profile: { id: user.id, role: user.role, orgId: user.orgId, displayName: user.name } },
    now,
    ai: null,
    bus,
    storage,
  };
}

async function reset() {
  // Сначала таблицы платформы: на auth.users ссылаются профили, и Auth не удалит пользователя со ссылками.
  const rows = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  const names = [...rows].map((r) => `"public"."${r.tablename}"`);
  if (names.length) await db.execute(sql.raw(`truncate ${names.join(', ')} restart identity cascade`));
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) {
      const del = await admin.auth.admin.deleteUser(u.id);
      if (del.error) throw new Error(`Не удалось удалить пользователя ${u.email}: ${del.error.message}`);
    }
  }
}

const usedEmails = new Set<string>();
async function createUser(email: string, name: string, role: Role, orgId: string | null): Promise<User> {
  if (usedEmails.has(email)) throw new Error(`Дубликат email ${email}`);
  usedEmails.add(email);
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { name } });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  await db.insert(profiles).values({ id: data.user.id, displayName: name, role, orgId });
  return { id: data.user.id, email, name, role, orgId };
}

const KIND: Record<StageKey, 'report' | 'interview' | 'link'> = { idea: 'report', problem: 'report', interviews: 'interview', prototype: 'link', testing: 'report' };
const NOTE: Record<StageKey, string> = {
  idea: 'Lean Canvas и питч идеи на одну минуту',
  problem: 'Опрос 40 респондентов и анализ открытых данных подтверждают проблему',
  interviews: 'Синтез интервью: кластеры болей и цитаты клиентов',
  prototype: 'Прототип основного сценария опубликован',
  testing: 'Юзабилити-тест на 5 пользователях, список доработок',
};

async function main() {
  console.log('Сброс данных…');
  await reset();
  await seedReferenceData(db);
  await storage.ensureBucket();

  const tasksJson = readData<TasksJson>('business-tasks.json');
  const teamsJson = readData<TeamsJson>('teams.json');

  console.log('Пользователи и организации…');
  const mentor = await createUser('mentor@sana.local', 'Гульнара Ержанова (куратор)', 'mentor', null);
  const mentor2 = await createUser('mentor2@sana.local', 'Сергей Ли (куратор)', 'mentor', null);
  const teacher = await createUser('teacher@sana.local', 'Айгерим Касымова (преподаватель)', 'teacher', null);
  const teacher2 = await createUser('teacher2@sana.local', 'Дмитрий Орлов (преподаватель)', 'teacher', null);
  const orgByKey = new Map<string, { id: string; user: User; name: string }>();
  for (const o of tasksJson.orgs) {
    const [row] = await db.insert(orgs).values({ name: o.name, kind: 'company' }).returning();
    const user = await createUser(`${o.key}@sana.local`, `Представитель «${o.name}»`, 'business', row!.id);
    orgByKey.set(o.key, { id: row!.id, user, name: o.name });
  }
  const [group] = await db.insert(orgs).values({ name: 'Поток AI Sana — 2026', kind: 'group' }).returning();

  console.log('Команды…');
  const teamInfo: { id: string; name: string; members: User[] }[] = [];
  let n = 0;
  for (const t of teamsJson) {
    const members: User[] = [];
    for (const m of t.members) {
      n++;
      const email = n === 1 ? 'alice@sana.local' : `student${String(n).padStart(2, '0')}@sana.local`;
      members.push(await createUser(email, m.name, 'student', group!.id));
    }
    const [row] = await db
      .insert(teams)
      .values({ name: t.name, orgId: group!.id, weeklyHours: t.weeklyHours, interests: t.interests, createdBy: members[0]!.id })
      .returning();
    await db.insert(teamMembers).values(members.map((m, i) => ({ teamId: row!.id, profileId: m.id, roleSlug: t.members[i]!.role })));
    await db.insert(teamSkills).values(t.skills.map((s) => ({ teamId: row!.id, skillSlug: s.slug, level: s.level })));
    teamInfo.push({ id: row!.id, name: t.name, members });
  }

  console.log('Задачи бизнеса…');
  const taskIdByTitle = new Map<string, string>();
  for (const [i, t] of tasksJson.tasks.entries()) {
    const org = orgByKey.get(t.org)!;
    const card = {
      title: { text: t.title, source: 'dialog' as const },
      ...Object.fromEntries(Object.entries(t.card).map(([k, v]) => [k, { text: v, source: 'dialog' as const }])),
    } as Parameters<typeof publishTask>[1]['card'];
    const row = await publishTask(ctxFor(org.user, at(today, -40 + i)), {
      ownerOrgId: org.id,
      title: t.title,
      summary: `${t.card.goal} ${t.card.criteria}`,
      readiness: t.readiness,
      requirements: { topic: t.topic, difficulty: t.difficulty, estHours: t.estHours, skills: t.skills },
      card,
      sourceRef: `seed:${i + 1}`,
      createdBy: org.user.id,
    });
    taskIdByTitle.set(t.title, row.id);
  }

  console.log('Проекты Startup Sprint…');
  // Сколько этапов подтверждено у первых десяти команд и сдают ли они в срок.
  const plan: { approved: number; onTime: boolean; extraInterviews: number; pendingNext: boolean; taskTitle?: string; business?: string }[] = [
    { approved: 4, onTime: true, extraInterviews: 3, pendingNext: false, taskTitle: 'Прогноз спроса на выпечку', business: 'daily' },
    { approved: 5, onTime: true, extraInterviews: 4, pendingNext: false },
    { approved: 4, onTime: false, extraInterviews: 2, pendingNext: true },
    { approved: 3, onTime: true, extraInterviews: 2, pendingNext: true, taskTitle: 'Трекинг посылок для клиентов', business: 'logkz' },
    { approved: 3, onTime: false, extraInterviews: 1, pendingNext: false },
    { approved: 2, onTime: true, extraInterviews: 1, pendingNext: true },
    { approved: 2, onTime: false, extraInterviews: 0, pendingNext: false },
    { approved: 1, onTime: true, extraInterviews: 0, pendingNext: true },
    { approved: 1, onTime: false, extraInterviews: 0, pendingNext: false },
    { approved: 0, onTime: true, extraInterviews: 0, pendingNext: true },
  ];
  const templates = ['idea-canvas', 'problem-data', 'int-conduct', 'proto-frontend', 'proto-backend', 'test-usability'];

  for (const [i, p] of plan.entries()) {
    const team = teamInfo[i]!;
    const captain = team.members[0]!;
    const start = at(today, -26 + i);
    let projectId: string;

    if (p.taskTitle && p.business) {
      // Задача бизнеса берётся через Challenge Match ещё до старта: отклик → принятие → проект в трекере.
      const biz = orgByKey.get(p.business)!.user;
      const appl = await match.apply(ctxFor(captain, at(start, -2)), { teamId: team.id, taskId: taskIdByTitle.get(p.taskTitle)!, message: 'Хотим взять эту задачу как стартап-проект' });
      const decided = await decideApplication(ctxFor(biz, at(start, 0)), appl.id, { decision: 'accept', comment: 'Добро пожаловать, ждём на установочной встрече' });
      projectId = decided.projectId!;
    } else {
      const proj = await sprint.createProject(ctxFor(captain, start), {
        teamId: team.id,
        title: `Проект команды «${team.name}»`,
        idea: `Студенческий стартап команды «${team.name}»: сервис для решения проблемы из области «${teamsJson[i]!.interests[0]}».`,
        startDate: dateOnly(start),
      });
      projectId = proj.id;
    }

    // Задачи из шаблонов, исполнители — участники по кругу.
    const taskIds: { id: string; stage: StageKey }[] = [];
    for (const [j, slug] of templates.entries()) {
      const tk = await sprint.createTask(ctxFor(captain, at(start, 0, j)), projectId, { templateSlug: slug, assigneeId: team.members[j % team.members.length]!.id });
      taskIds.push({ id: tk.id, stage: tk.stageKey });
    }

    for (const [si, stage] of STAGE_ORDER.entries()) {
      const offset = STAGE_PLAN_OFFSET_DAYS[stage];
      const submitAt = at(start, p.onTime ? offset - 1 : offset + 2, 3);
      if (submitAt > today) break;
      if (si < p.approved) {
        for (const tk of taskIds.filter((x) => x.stage === stage)) {
          const member = team.members[taskIds.indexOf(tk) % team.members.length]!;
          const ev = await sprint.submitEvidence(ctxFor(member, at(submitAt, 0, -2)), projectId, { target: 'task', taskId: tk.id, kind: 'report', note: 'Результат задачи: ссылка на документ и краткое описание выполненной работы' });
          await reviewEvidence(ctxFor(mentor, at(submitAt, 0, 1)), ev.id, { decision: 'approve', comment: '' });
        }
        if (stage === 'interviews') {
          for (let k = 0; k < p.extraInterviews; k++) {
            const iv = await sprint.submitEvidence(ctxFor(captain, at(submitAt, -2, k)), projectId, { target: 'interview', kind: 'interview', note: `Конспект интервью №${k + 1} с представителем целевой аудитории` });
            await reviewEvidence(ctxFor(i % 2 ? mentor2 : mentor, at(submitAt, -1, k)), iv.id, { decision: 'approve', comment: '' });
          }
        }
        const ev = await sprint.submitEvidence(ctxFor(captain, submitAt), projectId, {
          target: 'stage',
          stageKey: stage,
          kind: KIND[stage],
          ...(KIND[stage] === 'link' ? { url: `https://${team.name.toLowerCase()}.demo.sana.local` } : {}),
          note: NOTE[stage],
        });
        await reviewEvidence(ctxFor(i % 2 ? mentor2 : mentor, at(submitAt, 1)), ev.id, { decision: 'approve', comment: 'Принято' });
        if (p.business && (stage === 'idea' || stage === 'prototype')) {
          await match.feedback(ctxFor(orgByKey.get(p.business)!.user, at(submitAt, 2)), { evidenceId: ev.id, verdict: 'positive', comment: 'Результат полезен компании' });
        }
      } else {
        if (p.pendingNext && si === p.approved) {
          // Последний этап сдан и ждёт куратора — для демо очереди проверки.
          await sprint.submitEvidence(ctxFor(captain, at(today, -1)), projectId, {
            target: 'stage',
            stageKey: stage,
            kind: KIND[stage],
            ...(KIND[stage] === 'link' ? { url: `https://${team.name.toLowerCase()}.demo.sana.local` } : {}),
            note: NOTE[stage],
          });
        }
        break;
      }
    }
  }

  console.log('Заявки Challenge Match…');
  const applications: [number, string][] = [
    [9, 'Дашборд KPI водителей'],
    [12, 'Оптимизация маршрутов курьеров'],
    [19, 'Прогноз загрузки склада'],
    [10, 'Чат-бот поддержки по картам'],
    [17, 'Анализ отзывов гостей'],
  ];
  for (const [ti, title] of applications) {
    const team = teamInfo[ti]!;
    const taskId = taskIdByTitle.get(title);
    if (!taskId) throw new Error(`В данных нет задачи «${title}»`);
    await match.apply(ctxFor(team.members[0]!, at(today, -1)), { teamId: team.id, taskId, message: 'Наши навыки хорошо подходят под задачу' });
  }

  const accounts = {
    password: PASSWORD,
    note: 'Локальные тестовые аккаунты (создаются pnpm seed, пароль меняется при каждом запуске)',
    mentor: mentor.email,
    mentor2: mentor2.email,
    teacher: teacher.email,
    teacher2: teacher2.email,
    student: 'alice@sana.local (команда «Альфа», проект по задаче «Прогноз спроса на выпечку»)',
    business: [...orgByKey.values()].map((o) => `${o.user.email} — ${o.name}`),
    otherStudents: 'student02@sana.local … student50@sana.local',
  };
  writeFileSync(path.join(DATA_DIR, 'demo-accounts.json'), JSON.stringify(accounts, null, 2));

  const [stats] = await db.execute<{ users: number; teams: number; tasks: number; projects: number; events: number; pending: number }>(sql`
    select (select count(*) from profiles)::int as users, (select count(*) from teams)::int as teams,
           (select count(*) from tasks)::int as tasks, (select count(*) from sprint_projects)::int as projects,
           (select count(*) from point_events)::int as events, (select count(*) from evidence where status = 'pending')::int as pending
  `);
  console.log('Готово:', stats);
  console.log(`Аккаунты и пароль: ${path.relative(process.cwd(), path.join(DATA_DIR, 'demo-accounts.json'))}`);
}

try {
  await main();
} finally {
  await closeAllDb();
}
