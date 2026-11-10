import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { nextStepQuery } from '@/entities/project';

/** One clear suggestion; hidden when there is nothing to do or the hint fails. */
export function NextStepHint({ projectId, action }: { projectId: string; action?: ReactNode }) {
  const hint = useQuery(nextStepQuery(projectId));
  if (!hint.data) return null;
  const { text, potentialPoints } = hint.data;

  return (
    <div className="bg-accent flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center">
      <Sparkles className="text-primary size-5 shrink-0" />
      <p className="flex-1 text-sm">
        <span className="text-accent-foreground font-medium">Следующий шаг. </span>
        {text}
        {potentialPoints > 0 && <span className="text-accent-foreground font-medium"> До +{potentialPoints} баллов.</span>}
      </p>
      {action}
    </div>
  );
}
