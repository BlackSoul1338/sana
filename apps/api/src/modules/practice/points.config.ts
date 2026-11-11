/**
 * Initial Practice Lab scale, set by the development team; to be checked against the organizers' scale.
 * Speed is never rewarded: the dashboard only shows it.
 */
export const PRACTICE_POINTS = {
  quizPerCorrect: 2,
  /** Completeness: share of criteria covered (met 1, partial 0.5) times this value. */
  completeness: 20,
  selfCorrection: { each: 5, cap: 15 },
  completion: 10,
  verdictShare: { met: 1, partial: 0.5, missed: 0 },
} as const;
