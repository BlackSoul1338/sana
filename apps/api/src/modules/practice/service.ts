import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { practice } from '@sana/contracts';
import { inTx, requireProfile, requireRole, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso } from '../../platform/db/columns.js';
import { AppError, conflict, forbidden, invalid, notFound, rule } from '../../platform/errors.js';
import { profiles } from '../../core/identity/schema.js';
import { createEvidence } from '../../core/evidence/service.js';
import { award, totalsFor } from '../../core/points/ledger.js';
import { checkAttempt } from './ai.js';
import { PRACTICE_POINTS } from './points.config.js';
import { gapTopics, recommendNext } from './recommend.js';
import { preview, scoreQuiz, verifyCheck } from './rules.js';
import { plAssignments, plAttempts, plModules, plQuestions, plQuizAttempts } from './schema.js';
import { MAX_ATTEMPTS, MODULE, SUBJECT } from './types.js';

type AssignmentRow = typeof plAssignments.$inferSelect;
type AttemptRow = typeof plAttempts.$inferSelect;

const toAssignment = (r: AssignmentRow, myStatus: practice.Attempt['status'] | null = null) => ({
  id: r.id,
  moduleId: r.moduleId,
  title: r.title,
  condition: r.condition,
  materials: r.materials,
  difficulty: r.difficulty,
  criteria: r.criteria,
  createdAt: iso(r.createdAt),
  myStatus,
});

/** Attempts of one student on one assignment, oldest first: each preview counts corrections against earlier attempts. */
function toAttempts(rows: AttemptRow[], criteria: practice.Criterion[]): practice.Attempt[] {
  return rows.map((r, i) => {
    const p = preview(criteria, r.aiCheck ?? null, rows.slice(0, i).map((x) => x.aiCheck ?? null));
    return {
      id: r.id,
      assignmentId: r.assignmentId,
      profileId: r.profileId,
      attemptNo: r.attemptNo,
      answer: r.answer,
      check: r.aiCheck ?? null,
      status: r.status,
      evidenceId: r.evidenceId,
      preview: { correctness: p.correctness, completeness: p.completeness, selfCorrection: p.selfCorrection, completion: p.completion },
      corrected: p.corrected,
      createdAt: iso(r.createdAt),
    };
  });
}

async function findAssignment(db: DbLike, id: string) {
  const [row] = await db.select().from(plAssignments).where(eq(plAssignments.id, id)).limit(1);
  if (!row) throw notFound('Задание');
  return row;
}

async function lastQuizzes(db: DbLike, profileId: string, moduleIds: string[]) {
  if (!moduleIds.length) return new Map<string, typeof plQuizAttempts.$inferSelect>();
  const rows = await db
    .select()
    .from(plQuizAttempts)
    .where(and(eq(plQuizAttempts.profileId, profileId), inArray(plQuizAttempts.moduleId, moduleIds)))
    .orderBy(desc(plQuizAttempts.createdAt));
  const last = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!last.has(r.moduleId)) last.set(r.moduleId, r);
  return last;
}

export async function listModules(ctx: Ctx): Promise<practice.Module[]> {
  const p = requireProfile(ctx);
  const mods = await ctx.db.select().from(plModules).orderBy(asc(plModules.position), asc(plModules.title));
  const quizzes = p.role === 'student' ? await lastQuizzes(ctx.db, p.id, mods.map((m) => m.id)) : new Map();
  return mods.map((m) => {
    const q = quizzes.get(m.id);
    return { id: m.id, slug: m.slug, title: m.title, description: m.description, topics: m.topics, quiz: q ? { correct: q.correct, total: q.total } : null };
  });
}

async function moduleQuestions(db: DbLike, moduleId: string) {
  const [mod] = await db.select({ id: plModules.id }).from(plModules).where(eq(plModules.id, moduleId)).limit(1);
  if (!mod) throw notFound('Модуль');
  return db.select().from(plQuestions).where(eq(plQuestions.moduleId, moduleId)).orderBy(asc(plQuestions.slug));
}

export async function getQuiz(ctx: Ctx, moduleId: string) {
  const p = requireRole(ctx, 'student');
  const questions = await moduleQuestions(ctx.db, moduleId);
  const last = (await lastQuizzes(ctx.db, p.id, [moduleId])).get(moduleId);
  return {
    moduleId,
    questions: questions.map((q) => ({ id: q.id, topic: q.topic, text: q.text, options: q.options })),
    result: last ? { ...scoreQuiz(questions, last.answers), points: 0 } : null,
  };
}

export async function submitQuiz(ctx: Ctx, moduleId: string, input: z.infer<typeof practice.QuizInput>) {
  const p = requireRole(ctx, 'student');
  const questions = await moduleQuestions(ctx.db, moduleId);
  const known = new Set(questions.map((q) => q.id));
  if (input.answers.some((a) => !known.has(a.questionId))) throw invalid('Вопрос не из этого модуля', [{ path: 'answers', message: 'Неизвестный вопрос' }]);
  const result = scoreQuiz(questions, input.answers);
  return inTx(ctx, async (t) => {
    await t.db.insert(plQuizAttempts).values({ moduleId, profileId: p.id, answers: input.answers, correct: result.correct, total: result.total, createdAt: t.now });
    // The answer key is fixed, so the first attempt is scored at once; later attempts are practice only.
    const written = await award(t.db, [
      {
        subjectType: 'profile',
        subjectId: p.id,
        module: MODULE,
        ruleId: 'practice_quiz',
        points: result.correct * PRACTICE_POINTS.quizPerCorrect,
        explanation: `Тест модуля: ${result.correct} из ${result.total} верно`,
        idempotencyKey: `practice:quiz:${moduleId}:${p.id}`,
      },
    ]);
    return { ...result, points: written.reduce((s, e) => s + e.points, 0) };
  });
}

export async function listAssignments(ctx: Ctx, q: z.infer<typeof practice.AssignmentsQuery>) {
  const p = requireProfile(ctx);
  const rows = await ctx.db
    .select()
    .from(plAssignments)
    .where(q.moduleId ? eq(plAssignments.moduleId, q.moduleId) : undefined)
    .orderBy(asc(plAssignments.difficulty), asc(plAssignments.title));
  const latest = new Map<string, AttemptRow['status']>();
  if (p.role === 'student' && rows.length) {
    const attempts = await ctx.db
      .select({ assignmentId: plAttempts.assignmentId, status: plAttempts.status })
      .from(plAttempts)
      .where(and(eq(plAttempts.profileId, p.id), inArray(plAttempts.assignmentId, rows.map((r) => r.id))))
      .orderBy(desc(plAttempts.attemptNo));
    for (const a of attempts) if (!latest.has(a.assignmentId)) latest.set(a.assignmentId, a.status);
  }
  return rows.map((r) => toAssignment(r, latest.get(r.id) ?? null));
}

export async function createAssignment(ctx: Ctx, input: z.infer<typeof practice.NewAssignment>) {
  const p = requireRole(ctx, 'teacher');
  const [mod] = await ctx.db.select().from(plModules).where(eq(plModules.id, input.moduleId)).limit(1);
  if (!mod) throw notFound('Модуль');
  const errors = input.criteria
    .map((c, i) => (mod.topics.includes(c.topic) ? null : { path: `criteria.${i}.topic`, message: `Тема не из модуля: ${mod.topics.join(', ')}` }))
    .filter((e): e is { path: string; message: string } => !!e);
  if (errors.length) throw invalid('Темы критериев берутся из модуля', errors);
  const [row] = await ctx.db
    .insert(plAssignments)
    .values({
      moduleId: mod.id,
      title: input.title,
      condition: input.condition,
      materials: input.materials,
      difficulty: input.difficulty,
      criteria: input.criteria.map((c, i) => ({ ...c, id: `k${i + 1}` })),
      createdBy: p.id,
      createdAt: ctx.now,
    })
    .returning();
  return toAssignment(row!);
}

async function myAttempts(db: DbLike, assignmentId: string, profileId: string) {
  return db
    .select()
    .from(plAttempts)
    .where(and(eq(plAttempts.assignmentId, assignmentId), eq(plAttempts.profileId, profileId)))
    .orderBy(asc(plAttempts.attemptNo));
}

export async function listAttempts(ctx: Ctx, assignmentId: string) {
  const p = requireRole(ctx, 'student');
  const a = await findAssignment(ctx.db, assignmentId);
  return toAttempts(await myAttempts(ctx.db, a.id, p.id), a.criteria);
}

export async function createAttempt(ctx: Ctx, assignmentId: string, input: z.infer<typeof practice.AttemptInput>) {
  const p = requireRole(ctx, 'student');
  const a = await findAssignment(ctx.db, assignmentId);
  const quiz = (await lastQuizzes(ctx.db, p.id, [a.moduleId])).get(a.moduleId);
  if (!quiz) throw rule('Сначала пройдите тест модуля');
  const before = await myAttempts(ctx.db, a.id, p.id);
  if (before.some((x) => x.status === 'sent' || x.status === 'approved')) throw conflict('Работа уже у преподавателя');
  if (before.length >= MAX_ATTEMPTS) throw conflict(`Попыток не больше ${MAX_ATTEMPTS}`);

  // The model runs outside the transaction; when it is unavailable the work still goes to the teacher unchecked.
  let check: practice.Check | null = null;
  try {
    check = verifyCheck(await checkAttempt(ctx.ai, a, input.answer), a.criteria, input.answer);
  } catch (err) {
    if (!(err instanceof AppError && err.code === 'ai_unavailable')) throw err;
  }

  const [row] = await ctx.db
    .insert(plAttempts)
    .values({ assignmentId: a.id, profileId: p.id, attemptNo: before.length + 1, answer: input.answer, aiCheck: check, createdAt: ctx.now })
    .onConflictDoNothing()
    .returning();
  if (!row) throw conflict('Попытка уже отправлена из другой вкладки');
  return toAttempts([...before, row], a.criteria).at(-1)!;
}

export async function sendAttempt(ctx: Ctx, id: string) {
  const p = requireRole(ctx, 'student');
  return inTx(ctx, async (t) => {
    const [row] = await t.db.select().from(plAttempts).where(eq(plAttempts.id, id)).for('update').limit(1);
    if (!row) throw notFound('Попытка');
    if (row.profileId !== p.id) throw forbidden();
    if (row.status !== 'checked') throw conflict('Эта попытка уже отправлена или рассмотрена');
    const a = await findAssignment(t.db, row.assignmentId);
    const all = await myAttempts(t.db, a.id, p.id);
    if (all.at(-1)!.id !== row.id) throw conflict('Отправить можно только последнюю попытку');
    const ev = await createEvidence(t, {
      module: MODULE,
      subjectType: SUBJECT.attempt,
      subjectId: row.id,
      teamId: null,
      reviewerRole: 'teacher',
      kind: 'report',
      note: `${a.title}, попытка ${row.attemptNo}`,
    });
    await t.db.update(plAttempts).set({ status: 'sent', evidenceId: ev.id }).where(eq(plAttempts.id, row.id));
    return toAttempts(
      all.map((x) => (x.id === row.id ? { ...x, status: 'sent' as const, evidenceId: ev.id } : x)),
      a.criteria,
    ).at(-1)!;
  });
}

export async function getAttempt(ctx: Ctx, id: string) {
  const p = requireProfile(ctx);
  const [row] = await ctx.db.select().from(plAttempts).where(eq(plAttempts.id, id)).limit(1);
  if (!row) throw notFound('Попытка');
  if (row.profileId !== p.id && p.role !== 'teacher') throw forbidden();
  const a = await findAssignment(ctx.db, row.assignmentId);
  const all = await myAttempts(ctx.db, a.id, row.profileId);
  const [student] = await ctx.db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.id, row.profileId)).limit(1);
  const attempt = toAttempts(all, a.criteria).find((x) => x.id === row.id)!;
  return { ...attempt, assignment: toAssignment(a), studentName: student?.name ?? '' };
}

/** Teacher dashboard for one module in a fixed number of queries. */
export async function dashboard(ctx: Ctx, moduleId: string): Promise<practice.Dashboard> {
  requireRole(ctx, 'teacher');
  const [mod] = await ctx.db.select().from(plModules).where(eq(plModules.id, moduleId)).limit(1);
  if (!mod) throw notFound('Модуль');
  const assignments = await ctx.db.select().from(plAssignments).where(eq(plAssignments.moduleId, moduleId)).orderBy(asc(plAssignments.difficulty), asc(plAssignments.title));
  const ids = assignments.map((a) => a.id);
  const [attempts, questions, quizzes] = await Promise.all([
    ids.length ? ctx.db.select().from(plAttempts).where(inArray(plAttempts.assignmentId, ids)).orderBy(asc(plAttempts.attemptNo)) : Promise.resolve([] as AttemptRow[]),
    ctx.db.select().from(plQuestions).where(eq(plQuestions.moduleId, moduleId)),
    ctx.db.select().from(plQuizAttempts).where(eq(plQuizAttempts.moduleId, moduleId)).orderBy(desc(plQuizAttempts.createdAt)),
  ]);
  const studentIds = [...new Set([...attempts.map((a) => a.profileId), ...quizzes.map((q) => q.profileId)])];
  const [names, totals] = await Promise.all([
    studentIds.length ? ctx.db.select({ id: profiles.id, name: profiles.displayName }).from(profiles).where(inArray(profiles.id, studentIds)) : Promise.resolve([]),
    totalsFor(ctx.db, 'profile', studentIds, MODULE),
  ]);
  return buildDashboard({ assignments, attempts, questions, quizzes, names: new Map(names.map((n) => [n.id, n.name])), totals });
}

export function buildDashboard(d: {
  assignments: AssignmentRow[];
  attempts: AttemptRow[];
  questions: (typeof plQuestions.$inferSelect)[];
  quizzes: (typeof plQuizAttempts.$inferSelect)[];
  names: Map<string, string>;
  totals: Map<string, number>;
}): practice.Dashboard {
  const lastQuiz = new Map<string, (typeof d.quizzes)[number]>();
  for (const q of d.quizzes) if (!lastQuiz.has(q.profileId)) lastQuiz.set(q.profileId, q);
  const byCell = new Map<string, AttemptRow[]>();
  for (const a of d.attempts) {
    const k = `${a.profileId}:${a.assignmentId}`;
    byCell.set(k, [...(byCell.get(k) ?? []), a]);
  }

  const topicOf = new Map(d.questions.map((q) => [q.id, q.topic]));
  const problem = new Map<string, { quizWrong: number; criteriaMissed: number; seen: number }>();
  const bump = (topic: string, field: 'quizWrong' | 'criteriaMissed' | 'seen') => {
    const cur = problem.get(topic) ?? { quizWrong: 0, criteriaMissed: 0, seen: 0 };
    cur[field]++;
    problem.set(topic, cur);
  };
  for (const q of lastQuiz.values()) {
    const scored = scoreQuiz(d.questions, q.answers);
    for (const pq of scored.perQuestion) {
      const t = topicOf.get(pq.questionId)!;
      bump(t, 'seen');
      if (!pq.ok) bump(t, 'quizWrong');
    }
  }
  for (const rows of byCell.values()) {
    const latest = [...rows].reverse().find((r) => r.aiCheck);
    const a = d.assignments.find((x) => x.id === rows[0]!.assignmentId)!;
    for (const c of latest?.aiCheck?.criteria ?? []) {
      const t = a.criteria.find((x) => x.id === c.criterionId)?.topic;
      if (!t) continue;
      bump(t, 'seen');
      if (c.verdict === 'missed' || c.verdict === 'partial') bump(t, 'criteriaMissed');
    }
  }

  const students = [...new Set([...lastQuiz.keys(), ...d.attempts.map((a) => a.profileId)])]
    .map((id) => {
      const q = lastQuiz.get(id);
      const cells = d.assignments.flatMap((a) => {
        const rows = byCell.get(`${id}:${a.id}`);
        if (!rows?.length) return [];
        const last = rows.at(-1)!;
        const sentAt = rows.find((r) => r.status !== 'checked')?.createdAt;
        return [
          {
            assignmentId: a.id,
            attempts: rows.length,
            status: last.status,
            evidenceId: last.evidenceId,
            minutesToSend: sentAt ? Math.round((sentAt.getTime() - rows[0]!.createdAt.getTime()) / 60_000) : null,
          },
        ];
      });
      return { profileId: id, name: d.names.get(id) ?? '', quiz: q ? { correct: q.correct, total: q.total } : null, points: d.totals.get(id) ?? 0, cells };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return {
    assignments: d.assignments.map((a) => {
      const cells = students.flatMap((s) => s.cells.filter((c) => c.assignmentId === a.id));
      return {
        id: a.id,
        title: a.title,
        students: cells.length,
        approved: cells.filter((c) => c.status === 'approved').length,
        avgAttempts: cells.length ? Math.round((cells.reduce((s, c) => s + c.attempts, 0) / cells.length) * 10) / 10 : 0,
      };
    }),
    students,
    problemTopics: [...problem.entries()]
      .map(([topic, v]) => ({ topic, quizWrong: v.quizWrong, criteriaMissed: v.criteriaMissed, share: v.seen ? Math.round(((v.quizWrong + v.criteriaMissed) / v.seen) * 100) / 100 : 0 }))
      .filter((t) => t.quizWrong + t.criteriaMissed > 0)
      .sort((a, b) => b.share - a.share || a.topic.localeCompare(b.topic, 'ru')),
  };
}

export async function recommendation(ctx: Ctx) {
  const p = requireRole(ctx, 'student');
  const [mods, assignments, attempts, quizzes] = await Promise.all([
    ctx.db.select().from(plModules),
    ctx.db.select().from(plAssignments),
    ctx.db.select().from(plAttempts).where(eq(plAttempts.profileId, p.id)).orderBy(asc(plAttempts.attemptNo)),
    ctx.db.select().from(plQuizAttempts).where(eq(plQuizAttempts.profileId, p.id)).orderBy(desc(plQuizAttempts.createdAt)),
  ]);
  const questions = quizzes.length ? await ctx.db.select().from(plQuestions) : [];
  const lastQuiz = new Map<string, (typeof quizzes)[number]>();
  for (const q of quizzes) if (!lastQuiz.has(q.moduleId)) lastQuiz.set(q.moduleId, q);
  const quizWrong = [...lastQuiz.values()].flatMap((q) =>
    scoreQuiz(questions.filter((x) => x.moduleId === q.moduleId), q.answers)
      .perQuestion.filter((x) => !x.ok)
      .map((x) => questions.find((y) => y.id === x.questionId)!.topic),
  );
  const latestChecks = assignments.flatMap((a) => {
    const last = [...attempts].reverse().find((x) => x.assignmentId === a.id && x.aiCheck);
    return (last?.aiCheck?.criteria ?? []).map((c) => ({ topic: a.criteria.find((k) => k.id === c.criterionId)?.topic ?? '', verdict: c.verdict }));
  });
  const done = new Set(attempts.filter((x) => x.status === 'sent' || x.status === 'approved').map((x) => x.assignmentId));
  // Only modules whose test the student passed: the test opens the assignments.
  const open = new Set(lastQuiz.keys());
  const candidates = assignments
    .filter((a) => !done.has(a.id) && open.has(a.moduleId) && mods.some((m) => m.id === a.moduleId))
    .map((a) => ({ id: a.id, title: a.title, difficulty: a.difficulty, topics: a.criteria.map((c) => c.topic) }));
  return recommendNext(gapTopics(quizWrong, latestChecks), candidates);
}
