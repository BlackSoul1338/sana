import { SPRINT_POINTS, STAGE_TITLES } from './points.config.js';
import { submittedOnTime } from './rules.js';
import { STAGE_ORDER, type StageKey, type StageStatus } from './types.js';

export type NextStepState = {
  stages: { key: StageKey; status: StageStatus; plannedAt: string }[];
  approvedInterviews: number;
  pendingInterviews: number;
  hasWorkingPrototype: boolean;
  now: Date;
};

export type NextStepChoice = { ruleId: string; potentialPoints: number; action: string } | null;

export function currentStage(stages: NextStepState['stages']) {
  return STAGE_ORDER.map((k) => stages.find((s) => s.key === k)).find((s) => s && s.status !== 'approved') ?? null;
}

/**
 * Следующее полезное действие выбирает код: правило с наибольшим ещё не заработанным приростом.
 * Модель потом только формулирует рекомендацию — прогноз остаётся проверяемым.
 */
export function chooseNextStep(s: NextStepState): NextStepChoice {
  const candidates: NonNullable<NextStepChoice>[] = [];
  const cur = currentStage(s.stages);

  if (cur && (cur.status === 'open' || cur.status === 'rejected')) {
    const base = SPRINT_POINTS.stage[cur.key];
    const speed = submittedOnTime(s.now, cur.plannedAt) ? Math.min(SPRINT_POINTS.speed.cap, Math.round(base * SPRINT_POINTS.speed.share)) : 0;
    const proto = cur.key === 'prototype' && !s.hasWorkingPrototype ? SPRINT_POINTS.workingPrototype : 0;
    const what =
      cur.key === 'prototype'
        ? 'Опубликовать прототип и отправить ссылку на него как подтверждение этапа «Прототип»'
        : `Завершить этап «${STAGE_TITLES[cur.key]}» и отправить подтверждение куратору`;
    candidates.push({
      ruleId: cur.key === 'prototype' && proto ? 'working_prototype' : 'stage_completed',
      potentialPoints: base + speed + proto,
      action: `${what}${cur.status === 'rejected' ? ' (прошлое подтверждение отклонено — учтите комментарий куратора)' : ''}${speed ? `; срок ${cur.plannedAt} — успеете получить бонус за скорость` : ''}`,
    });
  }

  const interviewsOpen = cur ? STAGE_ORDER.indexOf(cur.key) >= STAGE_ORDER.indexOf('problem') : false;
  const counted = s.approvedInterviews + s.pendingInterviews;
  if (interviewsOpen && counted < SPRINT_POINTS.interview.cap) {
    const left = SPRINT_POINTS.interview.cap - counted;
    candidates.push({
      ruleId: 'interview',
      potentialPoints: left * SPRINT_POINTS.interview.each,
      action: `Провести и подтвердить ещё ${left} интервью с клиентами (засчитано ${s.approvedInterviews} из ${SPRINT_POINTS.interview.cap})`,
    });
  }

  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.potentialPoints - a.potentialPoints)[0]!;
}

export const templateText = (c: NonNullable<NextStepChoice>) => `${c.action}. Это даст до +${c.potentialPoints} баллов.`;
