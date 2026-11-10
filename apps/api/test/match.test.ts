import { beforeEach, describe, expect, it } from 'vitest';
import { tasks, taskSkills } from '../src/core/catalog/schema.js';
import { createUser, http, makeApp, resetDb, testDb, type TestUser } from './helpers/env.js';

const api = http(makeApp());

async function publish(biz: TestUser, t: { title: string; topic: string; difficulty: number; estHours: number; readiness?: number; skills: [string, boolean][] }) {
  const db = testDb();
  const [row] = await db
    .insert(tasks)
    .values({
      kind: 'business_challenge',
      ownerOrgId: biz.orgId!,
      status: 'published',
      title: t.title,
      summary: `${t.title}: краткое описание`,
      readiness: t.readiness ?? 80,
      topic: t.topic,
      difficulty: t.difficulty,
      estHours: t.estHours,
      payload: {},
      publishedAt: new Date(),
    })
    .returning();
  await db.insert(taskSkills).values(t.skills.map(([skillSlug, required]) => ({ taskId: row!.id, skillSlug, required })));
  return row!;
}

async function world() {
  const biz = await createUser('business', 'Кофейни');
  const other = await createUser('business', 'Логистика');
  const alice = await createUser('student', 'Алиса');
  const mentor = await createUser('mentor', 'Куратор');
  const team = (await api.post('/api/teams', alice, { name: 'Данные', weeklyHours: 10, interests: ['ритейл'] })).body;
  await api.put(`/api/teams/${team.id}/skills`, alice, { skills: [{ slug: 'python', level: 2 }, { slug: 'pandas', level: 2 }, { slug: 'react', level: 1 }] });
  const t = {
    demand: await publish(biz, { title: 'Прогноз спроса', topic: 'ритейл', difficulty: 2, estHours: 40, skills: [['python', true], ['pandas', true]] }),
    chatbot: await publish(biz, { title: 'Чат-бот поддержки', topic: 'ритейл', difficulty: 3, estHours: 120, skills: [['nlp', true], ['python', true]] }),
    routes: await publish(other, { title: 'Маршруты курьеров', topic: 'логистика', difficulty: 2, estHours: 60, skills: [['python', true], ['ml-classic', true]] }),
    dash: await publish(other, { title: 'Дашборд склада', topic: 'логистика', difficulty: 1, estHours: 30, skills: [['data-viz', true], ['sql-analytics', false]] }),
    app: await publish(other, { title: 'Мобильное приложение', topic: 'ритейл', difficulty: 2, estHours: 80, skills: [['flutter', true]] }),
    cv: await publish(biz, { title: 'Распознавание полок', topic: 'ритейл', difficulty: 3, estHours: 150, skills: [['computer-vision', true], ['python', true]] }),
  };
  return { biz, other, alice, mentor, team, t };
}

describe('Challenge Match: подбор → отклик → трекер → отзыв бизнеса', () => {
  beforeEach(resetDb);

  it('рекомендует не меньше пяти задач с объяснением и планом роста; фильтры работают', async () => {
    const { alice, team, t } = await world();
    const rec = (await api.get(`/api/match/recommendations?teamId=${team.id}`, alice)).body;
    expect(rec.items.length).toBeGreaterThanOrEqual(5);
    expect(rec.items[0]).toMatchObject({ taskId: t.demand.id, fit: { score: 100 } });
    expect(rec.items[0].fit.reasons[0]).toContain('Совпали навыки');
    const scores = rec.items.map((i: any) => i.fit.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(rec.growth.skillsToAdd.map((s: any) => s.slug)).toEqual(expect.arrayContaining(['nlp', 'computer-vision']));

    const filtered = (await api.get(`/api/match/recommendations?teamId=${team.id}&topic=логистика&difficulty=2`, alice)).body;
    expect(filtered.items.map((i: any) => i.taskId)).toEqual([t.routes.id]);

    const stranger = await createUser('student');
    expect((await api.get(`/api/match/recommendations?teamId=${team.id}`, stranger)).status).toBe(403);
  });

  it('сквозной путь: отклик → принятие бизнесом → проект в трекере → approve → отзыв → коэффициент', async () => {
    const { biz, other, alice, mentor, team, t } = await world();

    const app = await api.post('/api/match/applications', alice, { teamId: team.id, taskId: t.demand.id, message: 'У нас есть опыт с pandas' });
    expect(app.status).toBe(201);
    expect(app.body).toMatchObject({ status: 'pending', score: 100 });
    expect((await api.post('/api/match/applications', alice, { teamId: team.id, taskId: t.demand.id })).status).toBe(409);
    // За отклик баллов нет.
    expect((await api.get(`/api/points?subjectType=team&subjectId=${team.id}`, alice)).body).toEqual([]);

    // Решает только владелец задачи.
    expect((await api.post(`/api/match/applications/${app.body.id}/decision`, other, { decision: 'accept' })).status).toBe(403);
    expect((await api.post(`/api/match/applications/${app.body.id}/decision`, alice, { decision: 'accept' })).status).toBe(403);
    const dec = await api.post(`/api/match/applications/${app.body.id}/decision`, biz, { decision: 'accept', comment: 'Ждём на встрече' });
    expect(dec.status).toBe(200);
    expect(dec.body).toMatchObject({ application: { status: 'accepted' }, projectCreated: true });
    expect((await api.get(`/api/points?subjectType=team&subjectId=${team.id}`, alice)).body).toEqual([]);

    // Задача больше не рекомендуется; проект виден команде и бизнесу.
    const rec = (await api.get(`/api/match/recommendations?teamId=${team.id}`, alice)).body;
    expect(rec.items.map((i: any) => i.taskId)).not.toContain(t.demand.id);
    const projectId = dec.body.projectId;
    const proj = (await api.get(`/api/sprint/projects/${projectId}`, alice)).body;
    expect(proj).toMatchObject({ challengeTaskId: t.demand.id, title: 'Прогноз спроса' });
    expect((await api.get('/api/sprint/projects', biz)).body.map((p: any) => p.id)).toEqual([projectId]);
    expect((await api.get(`/api/sprint/projects/${projectId}`, other)).status).toBe(403);

    // Команда сдаёт этап; бизнес не видит неподтверждённое и не может дать отзыв до куратора.
    const ev = (await api.post(`/api/sprint/projects/${projectId}/evidence`, alice, { target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://canvas.example' })).body;
    expect((await api.get(`/api/sprint/projects/${projectId}`, biz)).body.evidence).toEqual([]);
    expect((await api.post('/api/match/feedback', biz, { evidenceId: ev.id, verdict: 'positive' })).status).toBe(422);

    const review = (await api.post(`/api/evidence/${ev.id}/review`, mentor, { decision: 'approve' })).body;
    const stagePoints = review.awarded.filter((a: any) => a.subjectType === 'team').reduce((s: number, a: any) => s + a.points, 0);
    expect((await api.get(`/api/sprint/projects/${projectId}`, biz)).body.evidence).toHaveLength(1);

    expect((await api.post('/api/match/feedback', other, { evidenceId: ev.id, verdict: 'positive' })).status).toBe(403);
    const fb = await api.post('/api/match/feedback', biz, { evidenceId: ev.id, verdict: 'positive', comment: 'Хороший канвас' });
    expect(fb.status).toBe(200);
    expect(fb.body.bonusPoints).toBe(Math.round(stagePoints * 0.25));
    expect((await api.post('/api/match/feedback', biz, { evidenceId: ev.id, verdict: 'positive' })).status).toBe(409);

    const events = (await api.get(`/api/points?subjectType=team&subjectId=${team.id}`, alice)).body;
    expect(events.filter((e: any) => e.ruleId === 'real_task_bonus')).toHaveLength(1);
    const feed = (await api.get(`/api/sprint/projects/${projectId}/feed`, alice)).body;
    expect(feed.achievements.map((a: any) => a.code)).toContain('real_task');
  });

  it('принятие привязывает задачу к уже активному проекту команды; отказ ничего не создаёт', async () => {
    const { biz, alice, team, t } = await world();
    const own = (await api.post('/api/sprint/projects', alice, { teamId: team.id, title: 'Свой проект', idea: 'Идея команды про аналитику продаж' })).body;
    const a1 = (await api.post('/api/match/applications', alice, { teamId: team.id, taskId: t.chatbot.id })).body;
    const declined = (await api.post(`/api/match/applications/${a1.id}/decision`, biz, { decision: 'decline', comment: 'Нужен опыт NLP' })).body;
    expect(declined).toMatchObject({ application: { status: 'declined' }, projectId: null, assignmentId: null });
    // После отказа можно подать снова.
    expect((await api.post('/api/match/applications', alice, { teamId: team.id, taskId: t.chatbot.id })).status).toBe(201);

    const a2 = (await api.post('/api/match/applications', alice, { teamId: team.id, taskId: t.demand.id })).body;
    const accepted = (await api.post(`/api/match/applications/${a2.id}/decision`, biz, { decision: 'accept' })).body;
    expect(accepted).toMatchObject({ projectId: own.id, projectCreated: false });
    expect((await api.post(`/api/match/applications/${a2.id}/decision`, biz, { decision: 'accept' })).status).toBe(409);
  });

  it('отзыв заявки и видимость заявок', async () => {
    const { biz, other, alice, team, t } = await world();
    const a = (await api.post('/api/match/applications', alice, { teamId: team.id, taskId: t.demand.id })).body;
    expect((await api.get(`/api/match/applications?taskId=${t.demand.id}`, biz)).body).toHaveLength(1);
    expect((await api.get(`/api/match/applications?taskId=${t.demand.id}`, other)).status).toBe(403);
    expect((await api.post(`/api/match/applications/${a.id}/withdraw`, alice)).body.status).toBe('withdrawn');
    expect((await api.post(`/api/match/applications/${a.id}/decision`, biz, { decision: 'accept' })).status).toBe(409);
  });
});
