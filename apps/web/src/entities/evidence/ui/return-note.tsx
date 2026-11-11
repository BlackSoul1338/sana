import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { evidenceDetailQuery } from '../api/queries';

/** A returned piece of work with the reviewer's comment, so the student knows what to fix. */
export function ReturnNote({ evidenceId, children }: { evidenceId: string; children: ReactNode }) {
  const { data } = useQuery(evidenceDetailQuery(evidenceId));
  return (
    <div className="bg-warning-soft grid gap-1 rounded-md px-3 py-2 text-sm">
      <p>{children}</p>
      {data?.reviewComment && <p className="font-medium whitespace-pre-line">«{data.reviewComment}»</p>}
    </div>
  );
}
