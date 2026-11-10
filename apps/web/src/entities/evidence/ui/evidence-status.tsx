import { EVIDENCE_STATUS } from '@/shared/config';
import { Status, type Tone } from '@/shared/ui/status';

const TONE: Record<keyof typeof EVIDENCE_STATUS, Tone> = {
  pending: 'warning',
  approved: 'success',
  adjusted: 'success',
  rejected: 'danger',
};

export function EvidenceStatus({ status }: { status: keyof typeof EVIDENCE_STATUS }) {
  return <Status tone={TONE[status]}>{EVIDENCE_STATUS[status]}</Status>;
}
