import { APPLICATION_STATUS } from '@/shared/config';
import { Status, type Tone } from '@/shared/ui/status';

const TONE: Record<keyof typeof APPLICATION_STATUS, Tone> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'danger',
  withdrawn: 'neutral',
};

export function ApplicationStatus({ status }: { status: keyof typeof APPLICATION_STATUS }) {
  return <Status tone={TONE[status]}>{APPLICATION_STATUS[status]}</Status>;
}
