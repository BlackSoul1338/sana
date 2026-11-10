export { recommendationsQuery, fitQuery } from './api/queries';
export { FitScore } from './ui/fit-score';
export { SkillChips } from './ui/skill-chips';
import type { Schemas } from '@/shared/api';
export type Fit = Schemas['Fit'];
export type Recommendation = Schemas['Recommendation'];
