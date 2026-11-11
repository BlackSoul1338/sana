import type { Schemas } from '@/shared/api';
export { researchKeys, researchTasksQuery, workspacesQuery, workspaceQuery, workspaceByEvidenceQuery } from './api/queries';
export { ConclusionView } from './ui/conclusion-view';
export type ResearchWorkspace = Schemas['ResearchWorkspace'];
export type ResearchItem = Schemas['ResearchItem'];
