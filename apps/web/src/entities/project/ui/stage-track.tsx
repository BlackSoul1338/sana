import { Check, Clock, RotateCcw } from 'lucide-react';
import { STAGE_TITLES } from '@/shared/config';
import { formatDay } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import type { Stage } from '../model/types';

function caption(stage: Stage) {
  if (stage.status === 'approved' && stage.completedAt) return `готово ${formatDay(stage.completedAt)}`;
  if (stage.status === 'submitted') return 'на проверке';
  if (stage.status === 'rejected') return 'нужна доработка';
  return `до ${formatDay(stage.plannedAt)}`;
}

/** Five sprint stages: one line on wide screens, a vertical list on phones. Done in mint, current in tomato, the rest quiet. */
export function StageTrack({ stages }: { stages: Stage[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-5 sm:gap-2" aria-label="Этапы спринта">
      {stages.map((stage, i) => {
        const done = stage.status === 'approved';
        const current = stage.isCurrent;
        return (
          <li key={stage.key} className="relative flex items-start gap-3 sm:block" aria-current={current ? 'step' : undefined}>
            {i < stages.length - 1 && (
              <span aria-hidden className={cn('absolute top-8 -bottom-3 left-3.5 w-0.5 -translate-x-1/2 rounded sm:hidden', done ? 'bg-success' : 'bg-border')} />
            )}
            <div className="flex items-center">
              <span
                className={cn(
                  'relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold',
                  done && 'border-success bg-success text-white',
                  current && !done && 'border-primary bg-background text-primary ring-primary/15 ring-4',
                  !done && !current && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : stage.status === 'submitted' ? (
                  <Clock className="size-3.5" />
                ) : stage.status === 'rejected' ? (
                  <RotateCcw className="text-destructive size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              {i < stages.length - 1 && (
                <span aria-hidden className={cn('mx-1 hidden h-0.5 flex-1 rounded sm:block', done ? 'bg-success' : 'bg-border')} />
              )}
            </div>
            <div className="pt-1 sm:mt-2 sm:pt-0 sm:pr-2">
              <div className={cn('text-sm leading-tight', current ? 'font-semibold' : done ? '' : 'text-muted-foreground')}>
                {STAGE_TITLES[stage.key]}
              </div>
              <div
                className={cn(
                  'mt-0.5 text-xs',
                  stage.status === 'rejected' ? 'text-destructive' : current ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {caption(stage)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
