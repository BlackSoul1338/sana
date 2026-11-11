import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, http, makeApp, mockAi, resetDb, type TestUser } from './helpers/env.js';

/** The fake model marks k2 missed until the answer mentions the IQR rule. */
const ai = mockAi(({ system, prompt }) => {
  if (!system.includes('помощник преподавателя')) throw new Error('unexpected call');
  const fixed = prompt.includes('IQR');
  return {
    criteria: [
      { criterionId: 'k1', verdict: 'met', explanation: 'Пропуски заполнены медианой.', errors: [], recommendation: '' },
      {
        criterionId: 'k2',
        verdict: fixed ? 'met' : 'missed',
        explanation: fixed ? 'Выбросы обработаны.' : 'Выбросы не обработаны.',
        errors: fixed ? [] : [{ quote: 'выбросы оставил', issue: 'Нужно правило отсечения' }, { quote: 'чего нет в ответе', issue: 'выдумано' }],
        recommendation: fixed ? '' : 'Опишите правило для выбросов.',
      },
    ],
  };
});

const withAi = http(makeApp({ ai }));
const noAi = http(makeApp());

async function setup(api = withAi) {
  const [student, teacher, mentor] = await Promise.all([createUser('student'), createUser('teacher'), createUser('mentor')]);
  const mod = (await api.get('/api/practice/modules', student)).body.find((m: any) => m.slug === 'python-data');
  const created = await api.post('/api/practice/assignments', teacher, {
    moduleId: mod.id,
    title: 'Очистка данных',
    condition: 'Очистите выгрузку продаж и опишите шаги с кодом.',
    difficulty: 1,
    criteria: [
      { title: 'Пропуски', description: 'Обработаны пропуски', topic: 'очистка данных', maxPoints: 10 },
      { title: 'Выбросы', description: 'Обработаны выбросы', topic: 'pandas', maxPoints: 20 },
    ],
  });
  expect(created.status).toBe(201);
  return { student, teacher, mentor, mod, assignment: created.body };
}

async function passQuiz(api: typeof withAi, student: TestUser, moduleId: string) {
  const quiz = (await api.get(`/api/practice/modules/${moduleId}/quiz`, student)).body;
  expect(quiz.questions[0]).not.toHaveProperty('correct');
  return api.post(`/api/practice/modules/${moduleId}/quiz`, student, { answers: quiz.questions.map((q: any) => ({ questionId: q.id, option: 0 })) });
}

describe('Practice Lab', () => {
  beforeEach(resetDb);

  it('тест → попытка → исправление → отправка → принятие преподавателем с баллами за исправление', async () => {
    const { student, teacher, mentor, mod, assignment } = await setup();
    const a = `/api/practice/assignments/${assignment.id}/attempts`;

    expect((await withAi.post(a, student, { answer: 'Пропуски заполнил медианой, выбросы оставил как есть.' })).status).toBe(422);
    const quiz = await passQuiz(withAi, student, mod.id);
    expect(quiz.status).toBe(200);
    expect(quiz.body.points).toBe(quiz.body.correct * 2);
    expect((await passQuiz(withAi, student, mod.id)).body.points).toBe(0);

    const first = await withAi.post(a, student, { answer: 'Пропуски заполнил медианой, выбросы оставил как есть.' });
    expect(first.status).toBe(201);
    expect(first.body.check.criteria[1]).toMatchObject({ verdict: 'missed', errors: [{ quote: 'выбросы оставил' }] });
    expect(first.body.check.droppedQuotes).toBe(1);

    const second = await withAi.post(a, student, { answer: 'Пропуски заполнил медианой, выбросы отсёк по правилу IQR.' });
    expect(second.body).toMatchObject({ attemptNo: 2, corrected: ['k2'], preview: { correctness: 30, completeness: 20, selfCorrection: 5 } });

    expect((await withAi.post(`/api/practice/attempts/${first.body.id}/send`, student)).status).toBe(409);
    const sent = await withAi.post(`/api/practice/attempts/${second.body.id}/send`, student);
    expect(sent.body).toMatchObject({ status: 'sent' });
    expect((await withAi.post(a, student, { answer: 'Ещё одна попытка, пока работа у преподавателя.' })).status).toBe(409);

    // Learning-track evidence: the mentor cannot review it, the teacher sees it in the queue.
    expect((await withAi.post(`/api/evidence/${sent.body.evidenceId}/review`, mentor, { decision: 'approve' })).status).toBe(403);
    expect((await withAi.get('/api/evidence?status=pending', teacher)).body.map((e: any) => e.id)).toEqual([sent.body.evidenceId]);
    const detail = await withAi.get(`/api/practice/attempts/${second.body.id}`, teacher);
    expect(detail.body).toMatchObject({ studentName: student.name, assignment: { id: assignment.id } });

    const review = await withAi.post(`/api/evidence/${sent.body.evidenceId}/review`, teacher, { decision: 'approve' });
    expect(review.status).toBe(200);
    expect(review.body.awarded.map((e: any) => [e.ruleId, e.points])).toEqual(
      expect.arrayContaining([
        ['practice_correctness', 30],
        ['practice_completeness', 20],
        ['practice_self_correction', 5],
        ['practice_completion', 10],
      ]),
    );
    expect(review.body.awarded.every((e: any) => e.subjectType === 'profile' && e.subjectId === student.id)).toBe(true);
    expect((await withAi.get(a, student)).body.at(-1).status).toBe('approved');

    const dash = (await withAi.get(`/api/practice/dashboard?moduleId=${mod.id}`, teacher)).body;
    expect(dash.students[0]).toMatchObject({ profileId: student.id, points: quiz.body.points + 65, cells: [{ attempts: 2, status: 'approved' }] });
    expect(dash.problemTopics.map((t: any) => t.topic)).toContain('очистка данных');
    expect((await withAi.get(`/api/practice/dashboard?moduleId=${mod.id}`, student)).status).toBe(403);
  });

  it('без модели попытка уходит преподавателю; принятие даёт только баллы за завершение; после отказа можно повторить', async () => {
    const { student, teacher, mod, assignment } = await setup(noAi);
    await passQuiz(noAi, student, mod.id);
    const a = `/api/practice/assignments/${assignment.id}/attempts`;
    const first = (await noAi.post(a, student, { answer: 'Пропуски заполнил медианой, выбросы оставил как есть.' })).body;
    expect(first.check).toBeNull();
    const sent = (await noAi.post(`/api/practice/attempts/${first.id}/send`, student)).body;
    await noAi.post(`/api/evidence/${sent.evidenceId}/review`, teacher, { decision: 'reject', comment: 'Добавьте обработку выбросов' });
    expect((await noAi.get(a, student)).body[0].status).toBe('rejected');

    const second = (await noAi.post(a, student, { answer: 'Пропуски — медианой, выбросы — по правилу IQR.' })).body;
    const sent2 = (await noAi.post(`/api/practice/attempts/${second.id}/send`, student)).body;
    const review = await noAi.post(`/api/evidence/${sent2.evidenceId}/review`, teacher, { decision: 'approve' });
    expect(review.body.awarded.map((e: any) => e.ruleId)).toEqual(['practice_completion']);
  });

  it('рекомендация ведёт к теме с пробелом; задания создаёт только преподаватель с темами модуля', async () => {
    const { student, teacher, mod, assignment } = await setup();
    const draft = {
      moduleId: mod.id,
      title: 'Тема не из модуля',
      condition: 'Условие задания достаточной длины для проверки.',
      difficulty: 1,
      criteria: [{ title: 'Критерий', description: 'Описание', topic: 'метрики', maxPoints: 5 }],
    };
    expect((await withAi.post('/api/practice/assignments', student, draft)).status).toBe(403);
    expect((await withAi.post('/api/practice/assignments', teacher, draft)).status).toBe(422);

    expect((await withAi.get('/api/practice/recommendation', student)).body).toBeNull();
    await passQuiz(withAi, student, mod.id);
    await withAi.post(`/api/practice/assignments/${assignment.id}/attempts`, student, { answer: 'Пропуски заполнил медианой, выбросы оставил как есть.' });
    expect((await withAi.get('/api/practice/recommendation', student)).body).toMatchObject({ assignmentId: assignment.id, topic: expect.any(String) });
  });
});
