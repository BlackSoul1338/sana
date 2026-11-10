import { READY_THRESHOLD } from '@/shared/config';
import { cn } from '@/shared/lib/utils';
import { readinessTone } from '../model/live-card';

export function ReadinessMeter({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const tone = readinessTone(value);
  return (
    <div className="grid gap-1.5">
      {size === 'md' && (
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">Готовность</span>
          <span className="text-2xl font-semibold tabular-nums">{value}%</span>
        </div>
      )}
      <div className={cn('bg-muted relative rounded-full', size === 'md' ? 'h-2' : 'h-1.5')} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label="Готовность карточки">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            tone === 'ready' ? 'bg-success' : tone === 'mid' ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${value}%` }}
        />
        <span aria-hidden className="bg-foreground/40 absolute -top-1 -bottom-1 w-0.5 rounded" style={{ left: `${READY_THRESHOLD}%` }} />
      </div>
    </div>
  );
}
