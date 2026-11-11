import { useQuery } from '@tanstack/react-query';
import { evidenceListQuery } from '@/entities/evidence';
import type { Role } from '@/entities/viewer';

/** Pending reviews for the reviewer roles; shares the cache with the queue, so a decision updates it at once. */
export function usePendingReviews(role: Role) {
  const reviewer = role === 'mentor' || role === 'teacher';
  const { data } = useQuery({ ...evidenceListQuery({ status: 'pending' }), enabled: reviewer, refetchInterval: 60_000 });
  return reviewer ? (data?.length ?? 0) : 0;
}
