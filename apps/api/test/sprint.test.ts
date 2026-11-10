import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, http, makeApp, mockAi, resetDb, type Clock, type TestUser } from './helpers/env.js';

const clock: Clock = { now: new Date('2026-11-01T09:00:00Z') };
const ai = mockAi(() => ({ text: 'Проведите ещё интервью — это даст до +30 баллов.' }));
const api = http(makeApp({ clock, ai }));

async function setup() {
  const alice = await createUser('student', 'Алиса');
  const bob = await createUser('student', 'Боб');
  const mentor = await createUser('mentor', 'Куратор');
  const team = (await api.post('/api/teams', alice, { name: 'Альфа', weeklyHours: 15 })).body;
  await api.post(`/api/teams/${team.id}/members`, alice, { profileId: bob.id, roleSlug: 'developer' });
  const project = (
    await api.post('/api/sprint/projects', alice, { teamId: team.id, title: 'Умная столовая', idea: 'Предзаказ обедов в столовой вуза без очередей', startDate: '2026-11-01' })
  ).body;
  return { alice, bob, mentor, team, project };
}

async function approve(mentor: TestUser, evidenceId: string, extra: Record<string, unknown> = {}) {
  const res = await api.post(`/api/evidence/${evidenceId}/review`, mentor, { decision: 'approve', ...extra });
  expect(res.status).toBe(200);
  return res.body;
}

describe('Startup Sprint: путь команды', () => {
  beforeEach(async () => {
    clock.now = new Date('2026-11-01T09:00:00Z');
    await resetDb();
  });

  it('проект создаётся с пятью этапами и плановыми датами шаблона', async () => {
    const { project } = await setup();
    expect(project.stages.map((s: any) => [s.key, s.plannedAt])).toEqual([
      ['idea', '2026-11-03'],
      ['problem', '2026-11-06'],
      ['interviews', '2026-11-11'],
      ['prototype', '2026-11-18'],
      ['testing', '2026-11-22'],
    ]);
    expect(project.stages[0].isCurrent).toBe(true);
  });

  it('демо-путь: идея → роли → интервью → прототип → баллы и рейтинг', async () => {
    const { alice, bob, mentor, team, project } = await setup();
    const pid = project.id;

    // Идея в срок: 10 + бонус 1.
    const idea = await api.post(`/api/sprint/projects/${pid}/evidence`, alice, { target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://docs.example/canvas' });
    expect(idea.status).toBe(201);
    // Пока на проверке — повторно сдать нельзя, следующий этап недоступен.
    expect((await api.post(`/api/sprint/projects/${pid}/evidence`, alice, { target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://x.y' })).status).toBe(409);
    expect((await api.post(`/api/sprint/projects/${pid}/evidence`, alice, { target: 'stage', stageKey: 'problem', kind: 'report', url: 'https://x.y' })).status).toBe(409);
    // Без approve баллов нет.
    expect((await api.get(`/api/sprint/projects/${pid}`, alice)).body.points.team).toBe(0);
    const r1 = await approve(mentor, idea.body.id);
    expect(r1.awarded.map((a: any) => a.ruleId).sort()).toEqual(['speed_bonus', 'stage_completed']);

    // Проблема — с опозданием: только баллы этапа.
    clock.now = new Date('2026-11-08T09:00:00Z');
    const prob = await api.post(`/api/sprint/projects/${pid}/evidence`, bob, { target: 'stage', stageKey: 'problem', kind: 'report', note: 'Опрос 42 студентов: 70% стоят в очереди больше 15 минут' });
    expect((await approve(mentor, prob.body.id)).awarded.map((a: any) => a.ruleId)).toEqual(['stage_completed']);

    // Интервью: два отдельных + закрытие этапа интервью-подтверждением.
    for (let i = 0; i < 2; i++) {
      const iv = await api.post(`/api/sprint/projects/${pid}/evidence`, alice, { target: 'interview', kind: 'interview', note: `Интервью №${i + 1} с сотрудником столовой, конспект в приложении` });
      await approve(mentor, iv.body.id);
    }
    const ivStage = await api.post(`/api/sprint/projects/${pid}/evidence`, alice, { target: 'stage', stageKey: 'interviews', kind: 'interview', note: 'Синтез трёх интервью: главная боль — очереди в 12:00' });
    const r3 = await approve(mentor, ivStage.body.id);
    // 8 ноября ≤ плана 11 ноября → бонус 3 (10% от 30).
    expect(r3.awarded.map((a: any) => [a.ruleId, a.points]).sort()).toEqual([
      ['interview', 10],
      ['speed_bonus', 3],
      ['stage_completed', 30],
    ]);

    // Задача с технологией — личные баллы исполнителю (Боб, React сложности 2 → 10).
    const task = (await api.post(`/api/sprint/projects/${pid}/tasks`, alice, { templateSlug: 'proto-frontend', assigneeId: bob.id })).body;
    expect(task.skillSlug).toBe('react');
    const tev = await api.post(`/api/sprint/projects/${pid}/evidence`, bob, { target: 'task', taskId: task.id, kind: 'screenshot', note: 'Экран предзаказа и корзины готов, скриншоты приложены' });
    const r4 = await approve(mentor, tev.body.id);
    expect(r4.awarded).toEqual([expect.objectContaining({ ruleId: 'task_done', subjectType: 'profile', subjectId: bob.id, points: 10 })]);

    // Прототип ссылкой после срока: этап 40 + работающий прототип 30 + технология React 10, без бонуса.
    clock.now = new Date('2026-11-20T09:00:00Z');
    const proto = await api.post(`/api/sprint/projects/${pid}/evidence`, alice, { target: 'stage', stageKey: 'prototype', kind: 'link', url: 'https://canteen.demo.app' });
    const r5 = await approve(mentor, proto.body.id);
    expect(r5.awarded.map((a: any) => [a.ruleId, a.points]).sort()).toEqual([
      ['stage_completed', 40],
      ['tech_complexity', 10],
      ['working_prototype', 30],
    ]);

    // Повторное решение по тому же подтверждению невозможно → баллы не удваиваются.
    expect((await api.post(`/api/evidence/${proto.body.id}/review`, mentor, { decision: 'approve' })).status).toBe(409);

    const view = (await api.get(`/api/sprint/projects/${pid}`, alice)).body;
    // идея 10+1, проблема 20 (поздно), интервью 30+3, три интервью 30, прототип 40, работающий прототип 30, React 10
    const expectedTeam = 11 + 20 + 33 + 30 + 40 + 30 + 10;
    expect(view.points.team).toBe(expectedTeam);
    expect(view.points.byMember[bob.id]).toBe(10);
    expect(view.stages.find((s: any) => s.key === 'testing').isCurrent).toBe(true);

    const feed = (await api.get(`/api/sprint/projects/${pid}/feed`, alice)).body;
    expect(feed.achievements.map((a: any) => a.code).sort()).toEqual(['first_interview', 'first_step', 'mvp_ready']);
    expect(feed.items.every((i: any) => i.explanation.length > 0)).toBe(true);

    const board = (await api.get('/api/leaderboard?subjectType=team&module=sprint', mentor)).body;
    expect(board[0]).toMatchObject({ subjectId: team.id, total: expectedTeam, rank: 1 });
  });

  it('отклонение возвращает этап в работу без баллов; корректировка — отдельным событием', async () => {
    const { alice, mentor, project } = await setup();
    const ev = await api.post(`/api/sprint/projects/${project.id}/evidence`, alice, { target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://a.b' });
    expect((await api.post(`/api/evidence/${ev.body.id}/review`, mentor, { decision: 'reject' })).status).toBe(422); // нужен комментарий
    const rej = await api.post(`/api/evidence/${ev.body.id}/review`, mentor, { decision: 'reject', comment: 'Нет сегментов клиентов' });
    expect(rej.body.awarded).toEqual([]);
    let view = (await api.get(`/api/sprint/projects/${project.id}`, alice)).body;
    expect(view.stages[0].status).toBe('rejected');

    const again = await api.post(`/api/sprint/projects/${project.id}/evidence`, alice, { target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://a.b/v2' });
    const adj = await api.post(`/api/evidence/${again.body.id}/review`, mentor, { decision: 'adjust', adjustPoints: -3, comment: 'Канвас неполный, но принимаю' });
    expect(adj.body.awarded.map((a: any) => [a.ruleId, a.points]).sort()).toEqual([
      ['mentor_adjustment', -3],
      ['speed_bonus', 1],
      ['stage_completed', 10],
    ]);
    view = (await api.get(`/api/sprint/projects/${project.id}`, alice)).body;
    expect(view.stages[0].status).toBe('approved');
    expect(view.points.team).toBe(8);
  });

  it('права: чужой студент и бизнес без связи не видят проект; студент не проверяет; бизнес не сдаёт', async () => {
    const { alice, project } = await setup();
    const stranger = await createUser('student', 'Чужой');
    const biz = await createUser('business', 'Компания');
    expect((await api.get(`/api/sprint/projects/${project.id}`, stranger)).status).toBe(403);
    expect((await api.get(`/api/sprint/projects/${project.id}`, biz)).status).toBe(403);
    const ev = await api.post(`/api/sprint/projects/${project.id}/evidence`, alice, { target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://a.b' });
    expect((await api.post(`/api/evidence/${ev.body.id}/review`, alice, { decision: 'approve' })).status).toBe(403);
    expect((await api.post(`/api/sprint/projects/${project.id}/evidence`, stranger, { target: 'interview', kind: 'interview', note: 'x'.repeat(30) })).status).toBe(403);
    expect((await api.patch(`/api/sprint/projects/${project.id}/stages/idea`, alice, { plannedAt: '2027-01-01' })).status).toBe(403);
  });

  it('интервью засчитываются максимум пять раз', async () => {
    const { alice, mentor, team, project } = await setup();
    for (let i = 0; i < 6; i++) {
      const iv = await api.post(`/api/sprint/projects/${project.id}/evidence`, alice, { target: 'interview', kind: 'interview', note: `Интервью ${i} — подробный конспект разговора` });
      await approve(mentor, iv.body.id);
    }
    const events = (await api.get(`/api/points?subjectType=team&subjectId=${team.id}`, alice)).body;
    expect(events.filter((e: any) => e.ruleId === 'interview')).toHaveLength(5);
    const feed = (await api.get(`/api/sprint/projects/${project.id}/feed`, alice)).body;
    expect(feed.achievements.map((a: any) => a.code)).toContain('five_interviews');
  });

  it('следующий шаг: выбирает код, формулирует модель; без модели — шаблон', async () => {
    const { alice, mentor, project } = await setup();
    const step = (await api.get(`/api/sprint/projects/${project.id}/next-step`, alice)).body;
    expect(step).toMatchObject({ ruleId: 'stage_completed', potentialPoints: 11, generatedBy: 'ai' });
    expect(ai.calls.at(-1)!.prompt).toContain('Потенциальные баллы: 11');

    const plain = http(makeApp({ clock }));
    const s2 = (await plain.get(`/api/sprint/projects/${project.id}/next-step`, alice)).body;
    expect(s2.generatedBy).toBe('template');
    expect(s2.text).toContain('+11');
    expect((await plain.get(`/api/sprint/projects/${project.id}/next-step`, mentor)).status).toBe(200);
  });
});
