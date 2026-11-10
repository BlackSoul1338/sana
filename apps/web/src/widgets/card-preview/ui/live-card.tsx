import { ReadinessMeter, toLiveFields, type FieldStatus, type TurnResult } from '@/entities/draft';
import { READY_THRESHOLD } from '@/shared/config';
import { cn } from '@/shared/lib/utils';
import { PointsChip } from '@/shared/ui/status';

const MARK: Record<FieldStatus, { label: string; className: string }> = {
  ok: { label: 'есть', className: 'bg-success' },
  weak: { label: 'слабо', className: 'bg-warning' },
  missing: { label: 'нет', className: 'bg-border' },
};

export function LiveCard({ turn, footer }: { turn: TurnResult; footer?: React.ReactNode }) {
  const fields = toLiveFields(turn);
  const toGo = Math.max(0, READY_THRESHOLD - turn.readiness);

  return (
    <div className="bg-card grid gap-5 rounded-xl border p-5">
      <div className="grid gap-2">
        <ReadinessMeter value={turn.readiness} />
        <p className="text-muted-foreground text-xs">
          {toGo > 0 ? `До порога ${READY_THRESHOLD}% не хватает ${toGo} — ответьте на вопросы слева` : 'Карточка готова к сборке'}
        </p>
      </div>
      <ul className="grid gap-3">
        {fields.map((f) => (
          <li key={f.key} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3">
            <span aria-hidden className={cn('mt-1.5 size-2 rounded-full', MARK[f.status].className)} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className={cn(f.status === 'missing' && 'text-muted-foreground')}>{f.label}</span>
                <span className="sr-only">{MARK[f.status].label}</span>
                {f.delta !== 0 && <PointsChip value={f.delta} />}
              </div>
              {f.text && <p className="text-muted-foreground line-clamp-2 text-xs">{f.text}</p>}
              {f.unverified && <p className="text-destructive text-xs">Не нашли этого в ваших ответах — уточните</p>}
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {Math.round(f.earned)}/{f.weight}
            </span>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}
