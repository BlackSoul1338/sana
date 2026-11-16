import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, http, makeApp, mockAi, resetDb } from './helpers/env.js';

/**
 * Deterministic "model": a field is considered filled when the business's messages contain the keyword.
 * The model is always "confident" about the goal and quotes text that is not in the messages — the quote check
 * has to catch it until the business names the goal itself.
 */
const KEYS: Record<string, string> = {
  title: 'прогноз спроса',
  context: 'сеть из 12 кофеен',
  users: 'управляющие кофеен',
  data: 'выгрузка продаж за 2 года в CSV',
  constraints: 'до конца декабря',
  criteria: 'списания ниже 5%',
};

function business(prompt: string) {
  return prompt
    .split('\n')
    .filter((line) => line.startsWith('Бизнес:'))
    .join('\n')
    .toLowerCase();
}

const ai = mockAi(({ system, prompt }) => {
  if (system.includes('Оцени семь полей')) {
    const text = business(prompt);
    const field = (key: string) =>
      text.includes(KEYS[key]!.toLowerCase())
        ? { status: 'OK', value: KEYS[key], quote: KEYS[key] }
        : { status: 'missing', value: 'не указано', quote: '' };
    const goalStated = text.includes('сократить списания');
    return {
      title: field('title'),
      context: field('context'),
      goal: goalStated ? { status: 'weak', value: 'сократить списания', quote: 'сократить списания' } : { status: 'ok', value: 'рост прибыли', quote: 'увеличить прибыль на 30%' },
      users: field('users'),
      data: field('data'),
      constraints: field('constraints'),
      criteria: field('criteria'),
      questions: [{ field: 'data', text: 'Какие данные о продажах вы готовы передать команде?' }],
    };
  }
  if (system.includes('собираешь карточку')) {
    const card = (t: string) => ({ text: t, source: 'dialog' });
    return {
      title: card('Прогноз спроса для кофеен'),
      context: card('Сеть из 12 кофеен закупает продукты вручную'),
      goal: card('Сократить списания'),
      users: card('Управляющие кофеен'),
      data: card('Выгрузка продаж за 2 года'),
      constraints: card('Придумано моделью'),
      criteria: card('Списания ниже 5%'),
      summary: 'Прогноз спроса, чтобы сократить списания в сети кофеен.',
      commercialSecretWarnings: [],
    };
  }
  return { topic: 'Ритейл', difficulty: 7, estHours: 2, skills: [{ slug: 'pandas', required: false }, { slug: 'ml-classic', required: true }, { slug: 'pandas', required: true }] };
});

const api = http(makeApp({ ai }));

describe('Business Challenge Builder', () => {
  beforeEach(resetDb);

  it('слабое описание → вопросы → ответы → карточка → публикация → каталог', async () => {
    const biz = await createUser('business', 'Кофейни');
    const start = await api.post('/api/bcb/drafts', biz, { text: 'Нужен прогноз спроса, а то много выбрасываем.' });
    expect(start.status).toBe(201);
    const t1 = start.body;
    // The invented goal did not pass the quote check.
    expect(t1.fields.find((f: any) => f.key === 'goal')).toMatchObject({ status: 'missing', quoteVerified: false });
    expect(t1.fields.find((f: any) => f.key === 'title')).toMatchObject({ status: 'ok', quoteVerified: true });
    expect(t1.readiness).toBe(5);
    expect(t1.questions.length).toBeGreaterThanOrEqual(3);
    expect(t1.questions[0]).toEqual({ field: 'data', text: 'Какие данные о продажах вы готовы передать команде?' });

    const t2 = (
      await api.post(`/api/bcb/drafts/${t1.draftId}/turns`, biz, {
        text: 'Мы сеть из 12 кофеен. Хотим сократить списания. Дадим выгрузка продаж за 2 года в CSV.',
      })
    ).body;
    expect(t2.readiness).toBe(48); // 5 + 15 + 7.5 (weak goal) + 20 = 47.5 → 48
    expect(t2.changes.map((c: any) => c.field).sort()).toEqual(['context', 'data', 'goal']);
    expect(t2.questions.length).toBeLessThanOrEqual(3);

    const t3 = (
      await api.post(`/api/bcb/drafts/${t1.draftId}/turns`, biz, { text: 'Пользователи — управляющие кофеен. Успех: списания ниже 5%.' })
    ).body;
    expect(t3.readiness).toBeGreaterThan(t2.readiness);

    const composed = await api.post(`/api/bcb/drafts/${t1.draftId}/compose`, biz);
    expect(composed.status).toBe(200);
    // The business never named constraints → "not specified", even if the model made something up.
    expect(composed.body.card.constraints).toEqual({ text: 'не указано', source: 'not_specified' });
    // Requirements are clamped to the allowed ranges; duplicate skills are removed.
    expect(composed.body.requirementsSuggestion).toMatchObject({ topic: 'ритейл', difficulty: 3, estHours: 4 });
    expect(composed.body.requirementsSuggestion.skills).toHaveLength(2);

    // Publishing requires explicit confirmation.
    expect((await api.post(`/api/bcb/drafts/${t1.draftId}/publish`, biz, {})).status).toBe(422);
    // The model proposes the requirements; publishing requires the business to confirm them.
    expect((await api.post(`/api/bcb/drafts/${t1.draftId}/publish`, biz, { confirm: true })).status).toBe(422);
    const edited = await api.patch(`/api/bcb/drafts/${t1.draftId}/card`, biz, {
      requirements: { topic: 'ритейл', difficulty: 2, estHours: 80, skills: [{ slug: 'pandas', required: true }, { slug: 'ml-classic', required: true }, { slug: 'data-viz', required: false }] },
    });
    expect(edited.status).toBe(200);
    const pub = await api.post(`/api/bcb/drafts/${t1.draftId}/publish`, biz, { confirm: true, requirementsConfirmed: true });
    expect(pub.status).toBe(201);
    expect(pub.body.points).toBe(t3.readiness);

    const student = await createUser('student');
    const catalog = (await api.get('/api/tasks', student)).body;
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0]).toMatchObject({ title: 'Прогноз спроса для кофеен', readiness: t3.readiness, difficulty: 2, topic: 'ритейл' });
    expect(catalog.items[0].skills).toHaveLength(3);

    const diff = (await api.get(`/api/bcb/drafts/${t1.draftId}/diff`, biz)).body;
    expect(diff.before.readiness).toBe(5);
    expect(diff.after.readiness).toBe(t3.readiness);
    expect(diff.steps).toHaveLength(2);
    expect(diff.steps[0].changes.length).toBeGreaterThan(0);

    const orgBoard = (await api.get('/api/leaderboard?subjectType=org', student)).body;
    expect(orgBoard[0]).toMatchObject({ total: t3.readiness, name: 'ООО Кофейни' });

    // Publishing a second time is not possible.
    expect((await api.post(`/api/bcb/drafts/${t1.draftId}/publish`, biz, { confirm: true, requirementsConfirmed: true })).status).toBe(409);
  });

  it('персональные данные блокируют сборку карточки', async () => {
    const biz = await createUser('business');
    const d = (await api.post('/api/bcb/drafts', biz, { text: 'Нужен прогноз спроса. Контакт: manager@coffee.kz, +7 701 123 45 67' })).body;
    const res = await api.post(`/api/bcb/drafts/${d.draftId}/compose`, biz);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('sensitive_data');
    expect(res.body.details.findings.map((f: any) => f.kind).sort()).toEqual(['email', 'phone']);
  });

  it('чужой черновик не виден; студенту конструктор недоступен; без модели — 502 и черновик не создаётся', async () => {
    const a = await createUser('business');
    const b = await createUser('business');
    const s = await createUser('student');
    const d = (await api.post('/api/bcb/drafts', a, { text: 'Нужен прогноз спроса для сети.' })).body;
    expect((await api.get(`/api/bcb/drafts/${d.draftId}`, b)).status).toBe(404);
    expect((await api.get(`/api/bcb/drafts/${d.draftId}`, s)).status).toBe(403);
    expect((await api.post('/api/bcb/drafts', s, { text: 'Я студент и хочу задачу' })).status).toBe(403);

    const noAi = http(makeApp());
    const fail = await noAi.post('/api/bcb/drafts', a, { text: 'Описание без модели.' });
    expect(fail.status).toBe(502);
    expect(fail.body.code).toBe('ai_unavailable');
    expect((await api.get('/api/bcb/drafts', a)).body).toHaveLength(1);
  });

  it('нарушение схемы моделью: одна повторная попытка, затем понятная ошибка', async () => {
    let calls = 0;
    const broken = mockAi(() => {
      calls++;
      return '{"title": "не объект"}';
    });
    const biz = await createUser('business');
    const res = await http(makeApp({ ai: broken })).post('/api/bcb/drafts', biz, { text: 'Нужен прогноз спроса для сети.' });
    expect(res.status).toBe(502);
    expect(res.body.detail).toContain('не по схеме');
    expect(calls).toBe(2);
  });
});
