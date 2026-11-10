import type { CardFieldKey } from '@sana/contracts';
import type { FieldState, FieldStatus } from './types.js';

export const FIELD_ORDER: CardFieldKey[] = ['title', 'context', 'goal', 'users', 'data', 'constraints', 'criteria'];

/** Веса полей (сумма 100). Стартовые значения — сверить со шкалой организаторов. */
export const FIELD_WEIGHTS: Record<CardFieldKey, number> = {
  data: 20,
  criteria: 20,
  context: 15,
  goal: 15,
  users: 15,
  constraints: 10,
  title: 5,
};

export const STATUS_FACTOR: Record<FieldStatus, number> = { ok: 1, weak: 0.5, missing: 0 };

/** Порог, после которого карточку предлагается собрать. */
export const READY_THRESHOLD = 80;
export const MAX_TURNS = 12;

export const FIELD_TITLES: Record<CardFieldKey, string> = {
  title: 'Название',
  context: 'Контекст',
  goal: 'Цель',
  users: 'Пользователи',
  data: 'Доступные данные',
  constraints: 'Ограничения',
  criteria: 'Критерии результата',
};

export type RawField = { key: CardFieldKey; status: FieldStatus; value: string; quote: string; quoteVerified: boolean };

/** Готовность считает код: «есть» — полный вес, «слабо» — половина, «нет» — ноль. */
export function scoreFields(fields: RawField[]): { readiness: number; fields: FieldState[] } {
  const scored = FIELD_ORDER.map((key) => {
    const f = fields.find((x) => x.key === key) ?? { key, status: 'missing' as const, value: 'не указано', quote: '', quoteVerified: false };
    const weight = FIELD_WEIGHTS[key];
    return { ...f, weight, earned: weight * STATUS_FACTOR[f.status] };
  });
  return { readiness: Math.round(scored.reduce((s, f) => s + f.earned, 0)), fields: scored };
}
