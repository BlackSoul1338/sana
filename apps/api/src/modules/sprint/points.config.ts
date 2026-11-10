import type { StageKey } from './types.js';

/**
 * Стартовая шкала баллов Startup Sprint. Значения предложены командой разработки
 * и должны быть сверены со шкалой организаторов — меняются только здесь.
 */
export const SPRINT_POINTS = {
  stage: { idea: 10, problem: 20, interviews: 30, prototype: 40, testing: 30 } satisfies Record<StageKey, number>,
  interview: { each: 10, cap: 5 },
  workingPrototype: 30,
  /** Вес технологии: 5 × сложность (1–3) → 5 / 10 / 15. */
  techPerDifficulty: 5,
  /** Скорость: доля от баллов подтверждённого этапа, не больше cap. Сама по себе баллов не даёт. */
  speed: { share: 0.1, cap: 5 },
  /** Личные баллы исполнителю подтверждённой задачи: 5 × сложность навыка (1, если навык не указан). */
  taskPerDifficulty: 5,
} as const;

/** Плановые сроки этапов в днях от старта. Задаются шаблоном, менять может только куратор. */
export const STAGE_PLAN_OFFSET_DAYS: Record<StageKey, number> = {
  idea: 2,
  problem: 5,
  interviews: 10,
  prototype: 17,
  testing: 21,
};

export const STAGE_TITLES: Record<StageKey, string> = {
  idea: 'Идея',
  problem: 'Проверка проблемы',
  interviews: 'Интервью с клиентами',
  prototype: 'Прототип',
  testing: 'Тестирование',
};
