import { describe, expect, it } from 'vitest';
import type { bcb } from '@sana/contracts';
import { scoreFields, FIELD_ORDER, type RawField } from './readiness.js';
import { normalize, quoteFound, verifyAnalysis } from './quotes.js';
import { selectQuestions } from './questions.js';
import { findSensitive, isValidIin, luhn } from './sensitive.js';
import { buildDiff, fieldChanges } from './diff.js';

const raw = (statuses: Partial<Record<(typeof FIELD_ORDER)[number], 'ok' | 'weak' | 'missing'>>): RawField[] =>
  FIELD_ORDER.map((key) => ({ key, status: statuses[key] ?? 'missing', value: 'x', quote: 'x', quoteVerified: true }));

describe('готовность', () => {
  it('ok — полный вес, weak — половина, missing — ноль; сумма весов 100', () => {
    expect(scoreFields(raw({ title: 'ok', context: 'ok', goal: 'ok', users: 'ok', data: 'ok', constraints: 'ok', criteria: 'ok' })).readiness).toBe(100);
    expect(scoreFields(raw({})).readiness).toBe(0);
    expect(scoreFields(raw({ data: 'weak', criteria: 'ok', title: 'ok' })).readiness).toBe(10 + 20 + 5);
  });
});

describe('проверка цитат', () => {
  it('нормализация: регистр, ё, кавычки, пробелы', () => {
    expect(normalize('  «Ёлка»   Растёт. ')).toBe('елка растет');
  });

  it('цитата ищется только в репликах бизнеса, допускаются фрагменты через многоточие', () => {
    const corpus = 'Мы сеть кофеен в Алматы. У нас есть выгрузка продаж за 2 года в CSV.';
    expect(quoteFound('выгрузка продаж за 2 года', corpus)).toBe(true);
    expect(quoteFound('сеть кофеен … за 2 года в csv', corpus)).toBe(true);
    expect(quoteFound('данные из CRM', corpus)).toBe(false);
    expect(quoteFound('', corpus)).toBe(false);
  });

  it('поле без подтверждённой цитаты становится missing', () => {
    const field = (status: 'ok' | 'weak' | 'missing', quote: string) => ({ status, value: 'v', quote });
    const ai: bcb.AiAnalysis = {
      title: field('ok', 'прогноз спроса'),
      context: field('weak', 'мы сеть кофеен'),
      goal: field('ok', 'Какую цель вы преследуете?'), // цитата из вопроса ассистента
      users: field('missing', ''),
      data: field('ok', 'выгрузка продаж'),
      constraints: field('missing', ''),
      criteria: field('ok', 'снизить списания'),
      questions: [],
    };
    const res = verifyAnalysis(ai, ['Нужен прогноз спроса. Мы сеть кофеен, есть выгрузка продаж.']);
    const by = Object.fromEntries(res.map((f) => [f.key, f.status]));
    expect(by).toEqual({ title: 'ok', context: 'weak', goal: 'missing', users: 'missing', data: 'ok', constraints: 'missing', criteria: 'missing' });
  });
});

describe('выбор вопросов', () => {
  it('первый ход: не меньше трёх, по весу пробела (данные и критерии первыми)', () => {
    const { fields } = scoreFields(raw({ title: 'ok', context: 'ok', goal: 'weak', users: 'ok' }));
    const qs = selectQuestions({ fields, aiQuestions: [{ field: 'data', text: 'Какие данные о продажах вы готовы передать?' }], turn: 1 });
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(qs.slice(0, 2).map((q) => q.field).sort()).toEqual(['criteria', 'data']);
    expect(qs[0]!.text).toBe('Какие данные о продажах вы готовы передать?');
  });

  it('первый ход при полном описании — всё равно три уточняющих вопроса', () => {
    const all = raw({ title: 'ok', context: 'ok', goal: 'ok', users: 'ok', data: 'ok', constraints: 'ok', criteria: 'ok' });
    const qs = selectQuestions({ fields: scoreFields(all).fields, aiQuestions: [], turn: 1 });
    expect(qs).toHaveLength(3);
  });

  it('следующие ходы: не больше трёх, только по пробелам', () => {
    const { fields } = scoreFields(raw({ title: 'ok' }));
    expect(selectQuestions({ fields, aiQuestions: [], turn: 2 })).toHaveLength(3);
    const done = scoreFields(raw({ title: 'ok', context: 'ok', goal: 'ok', users: 'ok', data: 'ok', constraints: 'ok', criteria: 'ok' })).fields;
    expect(selectQuestions({ fields: done, aiQuestions: [], turn: 3 })).toEqual([]);
  });
});

describe('чувствительные данные', () => {
  it('ИИН с контрольной цифрой, карта по Луну, телефон, email', () => {
    expect(isValidIin('900101300453')).toBe(true);
    expect(isValidIin('900101300454')).toBe(false);
    expect(isValidIin('901301300453')).toBe(false); // 13-й месяц
    expect(luhn('4111111111111111')).toBe(true);
    const f = findSensitive('Пишите ivan.petrov@corp.kz или +7 (701) 123-45-67, ИИН 851231400676, карта 4111 1111 1111 1111', 'реплика 1');
    expect(f.map((x) => x.kind).sort()).toEqual(['card', 'email', 'iin', 'phone']);
    expect(f.every((x) => !x.excerpt.includes('123-45'))).toBe(true);
  });

  it('бюджеты, артикулы и случайные 12-значные числа не считаются ИИН', () => {
    expect(findSensitive('Бюджет 150000000000 тенге, артикул 123456789012, заказ 4111111111111112', 'x')).toEqual([]);
  });
});

describe('сравнение до и после', () => {
  it('показывает, какой ответ поднял какое поле', () => {
    const s1 = scoreFields(raw({ title: 'ok' })).fields;
    const s2 = scoreFields(raw({ title: 'ok', data: 'ok', criteria: 'weak' })).fields;
    const changes = fieldChanges(s1, s2);
    expect(changes).toEqual([
      { field: 'data', from: 'missing', to: 'ok', delta: 20 },
      { field: 'criteria', from: 'missing', to: 'weak', delta: 10 },
    ]);
    const diff = buildDiff([
      { turn: 1, readiness: 5, fields: s1, changes: [], answer: 'исходное' },
      { turn: 2, readiness: 35, fields: s2, changes, answer: 'Дадим выгрузку продаж' },
    ])!;
    expect(diff.before.readiness).toBe(5);
    expect(diff.after.readiness).toBe(35);
    expect(diff.steps[0]).toMatchObject({ turn: 2, readinessDelta: 30 });
  });
});
