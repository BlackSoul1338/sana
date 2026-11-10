import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { diffQuery, ReadinessMeter } from '@/entities/draft';
import { CARD_FIELDS } from '@/shared/config';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';
import { PointsChip } from '@/shared/ui/status';

const STATUS = { ok: 'есть', weak: 'слабо', missing: 'нет' } as const;
const RANK = { missing: 0, weak: 1, ok: 2 } as const;

export function ReadinessDiff({ draftId }: { draftId: string }) {
  const diff = useQuery(diffQuery(draftId));
  if (diff.isPending) return <Skeleton className="h-48" />;
  if (diff.isError) return <p className="text-destructive text-sm">Не удалось построить сравнение</p>;
  const { before, after, steps } = diff.data;

  return (
    <div className="grid gap-8">
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-2">
          <span className="text-muted-foreground text-sm">Было — первое описание</span>
          <ReadinessMeter value={before.readiness} size="sm" />
          <span className="text-2xl font-semibold tabular-nums">{before.readiness}%</span>
        </div>
        <ArrowRight className="text-muted-foreground hidden sm:block" />
        <div className="grid gap-2">
          <span className="text-muted-foreground text-sm">Стало — после уточнений</span>
          <ReadinessMeter value={after.readiness} size="sm" />
          <span className="text-2xl font-semibold tabular-nums">{after.readiness}%</span>
        </div>
      </div>

      {steps.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">Какие ответы подняли готовность</h3>
          <ol className="grid gap-4">
            {steps.map((s) => (
              <li key={s.turn} className="grid grid-cols-[3rem_1fr] gap-3">
                <PointsChip value={s.readinessDelta} className="h-fit justify-self-start" />
                <div className="min-w-0">
                  <p className="text-sm">«{s.answer}»</p>
                  {s.changes.length > 0 && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {s.changes.map((c) => `${CARD_FIELDS[c.field].label}: ${STATUS[c.from]} → ${STATUS[c.to]}`).join(' · ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h3 className="mb-3 font-semibold">По полям</h3>
        <ul className="divide-y text-sm">
          {after.fields.map((f) => {
            const was = before.fields.find((b) => b.key === f.key);
            const change = was ? RANK[f.status] - RANK[was.status] : 0;
            return (
              <li key={f.key} className="flex items-center gap-3 py-2">
                <span className="flex-1">{CARD_FIELDS[f.key].label}</span>
                <span className="text-muted-foreground">{was ? STATUS[was.status] : '—'}</span>
                <ArrowRight className="text-muted-foreground size-3.5" />
                <span className={cn('w-12', change > 0 && 'text-success font-medium', change < 0 && 'text-destructive font-medium')}>{STATUS[f.status]}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
