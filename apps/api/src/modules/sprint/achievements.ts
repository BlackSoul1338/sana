import { STAGE_ORDER, type StageKey } from './types.js';

export const ACHIEVEMENTS = {
  first_step: 'Первый шаг: идея подтверждена',
  first_interview: 'Первое интервью с клиентом',
  five_interviews: 'Пять интервью: голос клиента услышан',
  mvp_ready: 'Работающий прототип',
  all_stages: 'Путь пройден: все этапы подтверждены',
  real_task: 'Работа над реальной задачей бизнеса',
} as const;
export type AchievementCode = keyof typeof ACHIEVEMENTS;

export type AchievementFacts = {
  approvedStages: StageKey[];
  approvedInterviews: number;
  hasWorkingPrototype: boolean;
  linkedToBusinessTask: boolean;
};

/** Какие достижения заслужены при текущем состоянии проекта. Вставка идемпотентна, поэтому можно звать после каждого события. */
export function earnedAchievements(f: AchievementFacts): AchievementCode[] {
  const out: AchievementCode[] = [];
  if (f.approvedStages.includes('idea')) out.push('first_step');
  if (f.approvedInterviews >= 1) out.push('first_interview');
  if (f.approvedInterviews >= 5) out.push('five_interviews');
  if (f.hasWorkingPrototype) out.push('mvp_ready');
  if (STAGE_ORDER.every((s) => f.approvedStages.includes(s))) out.push('all_stages');
  if (f.linkedToBusinessTask) out.push('real_task');
  return out;
}
