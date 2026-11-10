import { cn } from '@/shared/lib/utils';

/** Match percentage as a small ring: mint when strong, amber when partial, quiet when weak. */
export function FitScore({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? 'text-success' : score >= 45 ? 'text-warning' : 'text-muted-foreground';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={`Совпадение ${score}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          className={cn('stroke-current', tone)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{score}%</span>
    </div>
  );
}
