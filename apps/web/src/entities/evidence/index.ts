export { evidenceKeys, evidenceListQuery, evidenceDetailQuery } from './api/queries';
export { EvidenceStatus } from './ui/evidence-status';
import type { Schemas } from '@/shared/api';
export type Evidence = Schemas['Evidence'];
export type EvidenceDetail = Schemas['EvidenceDetail'];
