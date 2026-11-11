import type { Schemas } from '@/shared/api';
import { VERDICT } from '@/shared/config';
import { cn } from '@/shared/lib/utils';
import { Status } from '@/shared/ui/status';

type Criterion = Schemas['PracticeCriterion'];
type Check = NonNullable<Schemas['PracticeAttempt']['check']>;

/**
 * The model's check, criterion by criterion. Results appear one after another once,
 * when a fresh check arrives (`reveal`), so the student reads them in order; reduced motion shows them at once.
 */
export function CheckResult({ criteria, check, corrected = [], reveal = false }: { criteria: Criterion[]; check: Check | null; corrected?: string[]; reveal?: boolean }) {
  if (!check) {
    return <p className="text-muted-foreground text-sm">Модель сейчас недоступна — работу проверит преподаватель по тем же критериям.</p>;
  }
  const byId = new Map(check.criteria.map((c) => [c.criterionId, c]));
  return (
    <ol className="divide-y">
      {criteria.map((cr, i) => {
        const c = byId.get(cr.id);
        const v = c?.verdict ? VERDICT[c.verdict] : null;
        return (
          <li
            key={cr.id}
            className={cn('grid gap-1.5 py-4 first:pt-0', reveal && 'animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-300 motion-reduce:animate-none')}
            style={reveal ? { animationDelay: `${i * 120}ms` } : undefined}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-medium">{cr.title}</span>
              <span className="flex items-center gap-3">
                {corrected.includes(cr.id) && <span className="text-success text-xs font-medium">исправлено</span>}
                {v ? <Status tone={v.tone}>{v.label}</Status> : <Status tone="neutral">не проверено</Status>}
              </span>
            </div>
            {c?.explanation && <p className="text-sm">{c.explanation}</p>}
            {c?.errors.map((e, k) => (
              <p key={k} className="text-sm">
                <mark className="bg-warning-soft text-foreground rounded px-1">{e.quote}</mark>
                <span className="text-muted-foreground"> — {e.issue}</span>
              </p>
            ))}
            {c?.recommendation && c.verdict !== 'met' && <p className="text-muted-foreground text-sm">Что сделать: {c.recommendation}</p>}
          </li>
        );
      })}
    </ol>
  );
}
