import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';

const DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  primary: 'bg-primary',
  neutral: 'bg-muted-foreground/40',
};

/** Quiet status: a coloured dot + text, no pill background. */
export function Status({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-muted-foreground inline-flex items-center gap-1.5 text-xs whitespace-nowrap', className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} />
      {children}
    </span>
  );
}

/** "+20" points chip. */
export function PointsChip({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        value >= 0 ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {text && <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-lg font-semibold">{children}</h2>
      {aside}
    </div>
  );
}
