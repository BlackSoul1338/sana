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
import { eq, sql } from 'drizzle-orm';
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
import * as practice from '../src/modules/practice/service.js';
import { verifyCheck } from '../src/modules/practice/rules.js';
import { plAttempts, plModules, plQuestions } from '../src/modules/practice/schema.js';
import * as research from '../src/modules/research/service.js';
import { raConclusions } from '../src/modules/research/schema.js';
import { verifyGrowth } from '../src/modules/research/rules.js';
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

  console.log('Practice Lab…');
  await seedPractice({ teachers: [teacher, teacher2], students: teamInfo.flatMap((t) => t.members) });
  console.log('Team Research Arena…');
  await seedResearch({ teacher, teams: teamInfo });

  const accounts = {
    password: PASSWORD,
    note: 'Локальные тестовые аккаунты (создаются pnpm seed, пароль меняется при каждом запуске)',
    mentor: mentor.email,
    mentor2: mentor2.email,
    teacher: `${teacher.email} (Practice Lab: задания, панель, проверка работ)`,
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

type PracticeAssignmentJson = { module: string; title: string; difficulty: number; condition: string; materials: string; criteria: { title: string; description: string; topic: string; maxPoints: number }[] };
type PracticeAnswerJson = {
  assignment: string;
  quality: 'weak' | 'medium' | 'strong';
  answer: string;
  check: { verdict: 'met' | 'partial' | 'missed'; explanation: string; errors: { quote: string; issue: string }[]; recommendation: string }[];
};

/**
 * Practice Lab demo: 10 assignments, module tests, and attempts with stored check fixtures (no model calls).
 * Per answered assignment: one student fixes a weak attempt and gets approved, one waits for review, one has only a draft check.
 */
async function seedPractice({ teachers, students }: { teachers: User[]; students: User[] }) {
  const mods = await db.select().from(plModules);
  const modBySlug = new Map(mods.map((m) => [m.slug, m]));
  const questions = await db.select().from(plQuestions);
  const assignments = new Map<string, Awaited<ReturnType<typeof practice.createAssignment>>>();
  for (const [i, a] of readData<PracticeAssignmentJson[]>('practice-assignments.json').entries()) {
    const row = await practice.createAssignment(ctxFor(teachers[i % teachers.length]!, at(today, -20 + i)), {
      moduleId: modBySlug.get(a.module)!.id,
      title: a.title,
      condition: a.condition,
      materials: a.materials,
      difficulty: a.difficulty,
      criteria: a.criteria,
    });
    assignments.set(a.title, row);
  }

  const answers = readData<PracticeAnswerJson[]>('practice-answers.json');
  const pick = (title: string, quality: PracticeAnswerJson['quality']) => answers.find((x) => x.assignment === title && x.quality === quality)!;
  const titles = [...new Set(answers.map((x) => x.assignment))];
  let si = 0;
  for (const [ti, title] of titles.entries()) {
    const a = assignments.get(title)!;
    const qs = questions.filter((q) => q.moduleId === a.moduleId);
    const trio = [students[si++]!, students[si++]!, students[si++]!];
    for (const [k, st] of trio.entries()) {
      // One wrong answer per student, on a different topic each time, so the dashboard shows problem topics.
      const wrong = qs[(ti + k) % qs.length]!;
      await practice.submitQuiz(ctxFor(st, at(today, -10 + ti, k)), a.moduleId, {
        answers: qs.map((q) => ({ questionId: q.id, option: q.id === wrong.id ? (q.correct + 1) % q.options.length : q.correct })),
      });
    }
    const attempt = async (st: User, quality: PracticeAnswerJson['quality'], no: number, when: Date) => {
      const fx = pick(title, quality);
      const raw = { criteria: fx.check.map((c, i) => ({ criterionId: `k${i + 1}`, ...c })) };
      const [row] = await db
        .insert(plAttempts)
        .values({ assignmentId: a.id, profileId: st.id, attemptNo: no, answer: fx.answer, aiCheck: verifyCheck(raw, a.criteria, fx.answer), createdAt: when })
        .returning();
      return row!;
    };
    const [fixer, waiting, drafting] = trio as [User, User, User];
    await attempt(fixer, 'weak', 1, at(today, -6 + ti));
    const fixed = await attempt(fixer, 'strong', 2, at(today, -5 + ti));
    const sent = await practice.sendAttempt(ctxFor(fixer, at(today, -5 + ti, 1)), fixed.id);
    await reviewEvidence(ctxFor(teachers[ti % teachers.length]!, at(today, -4 + ti)), sent.evidenceId!, { decision: 'approve', comment: 'Принято' });
    const med = await attempt(waiting, 'medium', 1, at(today, -2, ti));
    await practice.sendAttempt(ctxFor(waiting, at(today, -2, ti + 1)), med.id);
    await attempt(drafting, 'weak', 1, at(today, -1, ti));
  }
}

type ResearchTaskJson = { title: string; question: string; context: string; rubric: Record<'argumentation' | 'completeness' | 'understanding' | 'originality', number> };
type Level = 'strong' | 'adequate' | 'weak';
type DiscussionJson = {
  task: string;
  team: number;
  initialPosition: string;
  roles: ('coordinator' | 'researcher' | 'critic' | 'editor')[];
  threads: { title: string; messages: [number, string][] }[];
  items: { ref: string; kind: 'argument' | 'source' | 'question'; by: number; text: string; url?: string; thread?: number; stance?: 'for' | 'against'; links?: string[] }[];
  conclusion?: {
    decision: 'approve' | 'pending';
    finalPosition: string;
    statements: { text: string; refs: string[] }[];
    assessment: { rubric: Record<string, Level>; growth: { initialQuote: string; finalQuote: string; explanation: string }; recommendations: string[] };
  };
};

/** Research demo: tasks, team workspaces with discussions and boards; conclusion assessments come from fixtures (no model calls). */
async function seedResearch({ teacher, teams }: { teacher: User; teams: { id: string; name: string; members: User[] }[] }) {
  const taskIds = new Map<string, string>();
  for (const [i, t] of readData<ResearchTaskJson[]>('research-tasks.json').entries()) {
    const row = await research.createTask(ctxFor(teacher, at(today, -15 + i)), {
      title: t.title,
      question: t.question,
      context: t.context,
      rubric: Object.entries(t.rubric).map(([key, maxPoints]) => ({ key: key as keyof ResearchTaskJson['rubric'], maxPoints, description: '' })),
    });
    taskIds.set(t.title, row.id);
  }
  for (const [di, d] of readData<DiscussionJson[]>('research-discussions.json').entries()) {
    const team = teams[d.team]!;
    const who = (i: number) => team.members[i % team.members.length]!;
    let clock = at(today, -9 + di);
    const tick = (m = 17) => (clock = new Date(clock.getTime() + m * 60_000));
    const ws = await research.startWorkspace(ctxFor(who(0), clock), taskIds.get(d.task)!, { teamId: team.id, initialPosition: d.initialPosition });
    await research.setRoles(ctxFor(who(0), tick()), ws.id, { roles: d.roles.slice(0, team.members.length).map((role, i) => ({ profileId: who(i).id, role })) });
    const threadIds: string[] = [];
    for (const t of d.threads) {
      const th = await research.createThread(ctxFor(who(0), tick()), ws.id, { title: t.title });
      threadIds.push(th.id);
      for (const [by, text] of t.messages) await research.postMessage(ctxFor(who(by), tick(23)), th.id, { text });
    }
    const itemIds = new Map<string, string>();
    for (const it of d.items) {
      const row = await research.addItem(ctxFor(who(it.by), tick(9)), ws.id, {
        kind: it.kind,
        text: it.text,
        ...(it.url ? { url: it.url } : {}),
        ...(it.thread !== undefined ? { threadId: threadIds[it.thread]! } : {}),
        ...(it.stance ? { stance: it.stance } : {}),
        linkIds: (it.links ?? []).map((r) => itemIds.get(r)!),
      });
      itemIds.set(it.ref, row.id);
    }
    if (!d.conclusion) continue;
    const c = d.conclusion;
    const statements = c.statements.map((s) => ({ text: s.text, itemIds: s.refs.map((r) => itemIds.get(r)!) }));
    const sent = await research.submitConclusion(ctxFor(who(0), tick(60)), ws.id, { finalPosition: c.finalPosition, statements });
    const finalTexts = [c.finalPosition, ...statements.map((s) => s.text)].join('\n');
    await db
      .update(raConclusions)
      .set({
        assessment: {
          rubric: Object.entries(c.assessment.rubric).map(([key, level]) => ({ key: key as keyof ResearchTaskJson['rubric'], level, explanation: '', itemIds: [] })),
          growth: verifyGrowth(c.assessment.growth, d.initialPosition, finalTexts),
          recommendations: c.assessment.recommendations,
        },
      })
      .where(eq(raConclusions.id, sent.conclusion!.id));
    if (c.decision === 'approve') await reviewEvidence(ctxFor(teacher, tick(240)), sent.conclusion!.evidenceId!, { decision: 'approve', comment: 'Принято: вывод опирается на данные' });
  }
}
