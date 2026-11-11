import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, http, makeApp, mockAi, resetDb } from './helpers/env.js';

/** Fake model: rates argumentation strong and everything else adequate; growth quotes come from the team's texts. */
const ai = mockAi(({ system }) => {
  if (system.includes('Структурируй обсуждение')) return { summary: 'Команда спорит о причинах очередей.', threads: [{ thread: 't1', summary: 'Касса или бариста', keyItems: ['a1', 'x9'], missingArguments: ['Данные по времени'] }], missingQuestions: ['Сколько длится заказ?', 'Есть ли данные чеков?'] };
  if (system.includes('Оцени итоговый вывод')) {
    return {
      rubric: [
        { key: 'argumentation', level: 'strong', explanation: 'Опирается на источник', refs: ['a1', 's1'] },
        { key: 'completeness', level: 'adequate', explanation: '', refs: [] },
        { key: 'understanding', level: 'adequate', explanation: '', refs: [] },
        { key: 'originality', level: 'weak', explanation: '', refs: [] },
      ],
      growth: { initialQuote: 'виновата касса', finalQuote: 'узкое место — бариста', explanation: 'Позиция опирается на данные' },
      recommendations: ['Проверьте выходные'],
    };
  }
  throw new Error('unexpected call');
});
const api = http(makeApp({ ai }));

async function setup() {
  const [teacher, ann, bob, stranger, mentor] = await Promise.all([createUser('teacher'), createUser('student'), createUser('student'), createUser('student'), createUser('mentor')]);
  const team = (await api.post('/api/teams', ann, { name: 'Гамма', weeklyHours: 10, interests: [] })).body;
  await api.post(`/api/teams/${team.id}/members`, ann, { profileId: bob.id });
  const rubric = ['argumentation', 'completeness', 'understanding', 'originality'].map((key) => ({ key, maxPoints: 20 }));
  const task = await api.post('/api/research/tasks', teacher, { title: 'Очереди в кофейне', question: 'Почему утром в кофейне очереди?', rubric });
  expect(task.status).toBe(201);
  return { teacher, ann, bob, stranger, mentor, team, task: task.body };
}

describe('Team Research Arena', () => {
  beforeEach(resetDb);

  it('позиция → ветка → доска → сводка → вывод со ссылками → принятие → баллы команде и авторам', async () => {
    const { teacher, ann, bob, stranger, mentor, team, task } = await setup();
    expect((await api.post('/api/research/tasks', ann, { title: 'x', question: 'y', rubric: [] })).status).toBe(422);
    const ws = await api.post(`/api/research/tasks/${task.id}/workspaces`, ann, { teamId: team.id, initialPosition: 'Думаем, что виновата касса.' });
    expect(ws.status).toBe(201);
    const w = `/api/research/workspaces/${ws.body.id}`;
    expect((await api.post(`/api/research/tasks/${task.id}/workspaces`, bob, { teamId: team.id, initialPosition: 'Ещё раз то же самое.' })).status).toBe(409);
    expect((await api.get(w, stranger)).status).toBe(403);

    expect((await api.put(`${w}/roles`, ann, { roles: [{ profileId: ann.id, role: 'coordinator' }, { profileId: bob.id, role: 'critic' }] })).status).toBe(200);
    const thread = (await api.post(`${w}/threads`, ann, { title: 'Касса или бариста' })).body;
    const m1 = (await api.post(`/api/research/threads/${thread.id}/messages`, bob, { text: 'Посмотрел чеки: касса быстрая.' })).body;
    const page = (await api.get(`${w}/messages`, ann)).body;
    expect(page.items.map((m: any) => m.id)).toEqual([m1.id]);
    expect((await api.get(`${w}/messages?cursor=${encodeURIComponent(page.nextCursor)}`, ann)).body.items).toEqual([]);

    const s1 = (await api.post(`${w}/items`, bob, { kind: 'source', text: 'Выгрузка чеков за неделю', url: 'https://example.com/receipts' })).body;
    const a1 = (await api.post(`${w}/items`, ann, { kind: 'argument', text: 'Приготовление дольше оплаты', threadId: thread.id, stance: 'for', linkIds: [s1.id] })).body;
    const q1 = (await api.post(`${w}/items`, ann, { kind: 'question', text: 'Сколько бариста на смене?' })).body;
    expect((await api.post(`${w}/items`, ann, { kind: 'source', text: 'Без ссылки' })).status).toBe(422);

    const summarized = (await api.post(`${w}/summary`, teacher)).body;
    expect(summarized.summary.threads[0]).toMatchObject({ threadId: thread.id, keyItemIds: [a1.id] });
    expect(summarized.argumentMap.noCounterArguments).toEqual([thread.id]);

    const unsupported = await api.post(`${w}/conclusion`, ann, { finalPosition: 'Узкое место — бариста.', statements: [{ text: 'Нужно больше людей', itemIds: [q1.id] }] });
    expect(unsupported.status).toBe(422);
    const sent = await api.post(`${w}/conclusion`, ann, { finalPosition: 'Узкое место — бариста, а не касса.', statements: [{ text: 'Заказ готовится дольше, чем оплачивается', itemIds: [a1.id, s1.id] }] });
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ status: 'submitted', conclusion: { version: 1, growth: { citedSources: 1, citedArguments: 1 }, assessment: { growth: { initialQuote: 'виновата касса' } } } });
    expect((await api.post(`${w}/conclusion`, ann, { finalPosition: 'Вторая версия вывода.', statements: [{ text: 'то же', itemIds: [a1.id] }] })).status).toBe(409);

    const evId = sent.body.conclusion.evidenceId;
    expect((await api.post(`/api/evidence/${evId}/review`, mentor, { decision: 'approve' })).status).toBe(403);
    expect((await api.get(`/api/research/evidence/${evId}/workspace`, teacher)).body.id).toBe(ws.body.id);
    const review = await api.post(`/api/evidence/${evId}/review`, teacher, { decision: 'approve' });
    expect(review.status).toBe(200);
    const pts = review.body.awarded.map((e: any) => [e.subjectType, e.subjectId, e.ruleId, e.points]);
    expect(pts).toEqual(
      expect.arrayContaining([
        ['team', team.id, 'research_argumentation', 20],
        ['team', team.id, 'research_completeness', 12],
        ['team', team.id, 'research_originality', 4],
        ['team', team.id, 'research_completion', 10],
        ['profile', ann.id, 'research_cited', 3],
        ['profile', bob.id, 'research_cited', 3],
      ]),
    );
    const final = (await api.get(w, bob)).body;
    expect(final).toMatchObject({ status: 'approved', points: 58 });
    expect(final.contribution.find((c: any) => c.profileId === bob.id)).toMatchObject({ role: 'critic', sourcesAdded: 1, citedInConclusion: 1 });
    expect((await api.post(`${w}/items`, ann, { kind: 'question', text: 'Ещё вопрос?' })).status).toBe(409);
    expect((await api.get('/api/research/workspaces', teacher)).body).toEqual([expect.objectContaining({ id: ws.body.id, teamName: 'Гамма', status: 'approved', items: 3 })]);
  });

  it('отклонение возвращает исследование команде; без модели вывод уходит без оценки', async () => {
    const { teacher, ann, team, task } = await setup();
    const plain = http(makeApp());
    const ws = (await plain.post(`/api/research/tasks/${task.id}/workspaces`, ann, { teamId: team.id, initialPosition: 'Начальная позиция команды.' })).body;
    const w = `/api/research/workspaces/${ws.id}`;
    const a = (await plain.post(`${w}/items`, ann, { kind: 'argument', text: 'Аргумент' })).body;
    expect((await plain.post(`${w}/summary`, ann)).status).toBe(502);
    const sent = (await plain.post(`${w}/conclusion`, ann, { finalPosition: 'Итоговая позиция.', statements: [{ text: 'Утверждение', itemIds: [a.id] }] })).body;
    expect(sent.conclusion.assessment).toBeNull();
    await plain.post(`/api/evidence/${sent.conclusion.evidenceId}/review`, teacher, { decision: 'reject', comment: 'Добавьте источники' });
    expect((await plain.get(w, ann)).body.status).toBe('active');
    const again = await plain.post(`${w}/conclusion`, ann, { finalPosition: 'Итоговая позиция 2.', statements: [{ text: 'Утверждение', itemIds: [a.id] }] });
    expect(again.body.conclusion.version).toBe(2);
  });
});
