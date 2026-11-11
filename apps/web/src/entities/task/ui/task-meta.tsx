import { DIFFICULTY } from '@/shared/config';
import { cn } from '@/shared/lib/utils';

/** Difficulty as three short bars: the level is read at a glance, the word is for screen readers. */
function DifficultyBars({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Сложность: ${DIFFICULTY[level as 1 | 2 | 3]?.toLowerCase()}`} title={DIFFICULTY[level as 1 | 2 | 3]}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn('h-2.5 w-1 rounded-full', i <= level ? 'bg-foreground/60' : 'bg-border')} />
      ))}
    </span>
  );
}

export function TaskMeta({ topic, difficulty, estHours, orgName }: { topic: string; difficulty: number; estHours: number; orgName?: string }) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {orgName && <span className="text-foreground">{orgName}</span>}
      <span>{topic}</span>
      <DifficultyBars level={difficulty} />
      <span className="tabular-nums">~{estHours} ч</span>
    </p>
  );
}
