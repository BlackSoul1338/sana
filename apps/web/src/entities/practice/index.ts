import type { Schemas } from '@/shared/api';
export { practiceKeys, modulesQuery, quizQuery, assignmentsQuery, attemptsQuery, attemptQuery, dashboardQuery, recommendationQuery } from './api/queries';
export { CheckResult } from './ui/check-result';
export type PracticeAssignment = Schemas['PracticeAssignment'];
export type PracticeAttempt = Schemas['PracticeAttempt'];
export type PracticeCheck = NonNullable<Schemas['PracticeAttempt']['check']>;
