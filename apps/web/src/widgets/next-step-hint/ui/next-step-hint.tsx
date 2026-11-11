import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { nextStepQuery } from '@/entities/project';

/** One clear suggestion led by what it is worth; hidden when there is nothing to do or the hint fails. */
export function NextStepHint({ projectId, action }: { projectId: string; action?: ReactNode }) {
  const hint = useQuery(nextStepQuery(projectId));
  if (!hint.data) return null;
  const { text, potentialPoints } = hint.data;

  return (
    <div className="bg-accent flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:gap-5">
      {potentialPoints > 0 && (
        <div className="text-accent-foreground shrink-0 leading-none">
          <div className="text-2xl font-semibold tabular-nums">+{potentialPoints}</div>
          <div className="mt-1 text-xs">можно получить</div>
        </div>
      )}
      <p className="flex-1 text-sm">
        <span className="text-accent-foreground font-medium">Следующий шаг. </span>
        {text}
      </p>
      {action}
    </div>
  );
}
