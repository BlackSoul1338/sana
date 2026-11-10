export const STAGE_ORDER = ['idea', 'problem', 'interviews', 'prototype', 'testing'] as const;
export type StageKey = (typeof STAGE_ORDER)[number];
export type StageStatus = 'open' | 'submitted' | 'approved' | 'rejected';

export const MODULE = 'sprint';

/** Типы субъектов подтверждения в модуле. */
export const SUBJECT = {
  stage: 'sprint_stage',
  task: 'sprint_task',
  interview: 'sprint_interview',
} as const;
