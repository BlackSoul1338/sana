import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { feedQuery } from '@/entities/project';
import { RULE_TITLES } from '@/shared/config';
import { formatRelative } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, PointsChip } from '@/shared/ui/status';

export function ProjectFeed({ projectId, members }: { projectId: string; members: Record<string, string> }) {
  const feed = useQuery(feedQuery(projectId));

  if (feed.isPending) return <Skeleton className="h-40" />;
  if (feed.isError) return <p className="text-destructive text-sm">Не удалось загрузить ленту</p>;
  const { items, achievements } = feed.data;

  return (
    <div className="grid gap-6">
      {achievements.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Достижения">
          {achievements.map((a) => (
            <li key={a.code} className="bg-warning-soft inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" title={formatRelative(a.earnedAt)}>
              <Trophy className="text-warning size-3.5" />
              {a.title}
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 ? (
        <EmptyState title="Пока тихо" text="Баллы появятся, когда ментор подтвердит первый результат." />
      ) : (
        <ol className="grid gap-4">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <div className="w-12 shrink-0 pt-0.5">
                {item.type === 'points' && item.points !== null ? (
                  <PointsChip value={item.points} />
                ) : (
                  <Trophy className="text-warning ml-2 size-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {item.type === 'points' ? (RULE_TITLES[item.title] ?? 'Начисление') : item.title}
                  {item.subjectType === 'profile' && members[item.subjectId] && (
                    <span className="text-muted-foreground font-normal"> · {members[item.subjectId]}</span>
                  )}
                </div>
                {item.explanation && <p className="text-muted-foreground text-sm">{item.explanation}</p>}
                <div className="text-muted-foreground mt-0.5 text-xs">{formatRelative(item.at)}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
