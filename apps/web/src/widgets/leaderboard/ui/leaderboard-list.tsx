import { useQuery } from '@tanstack/react-query';
import { leaderboardQuery } from '@/entities/point';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';

export function LeaderboardList({
  subjectType = 'team',
  limit = 5,
  highlightId,
}: {
  subjectType?: 'team' | 'profile' | 'org';
  limit?: number;
  highlightId?: string;
}) {
  const board = useQuery(leaderboardQuery(subjectType, limit));
  if (board.isPending) return <Skeleton className="h-40" />;
  if (board.isError) return <p className="text-destructive text-sm">Не удалось загрузить рейтинг</p>;
  if (board.data.length === 0) return <p className="text-muted-foreground text-sm">Рейтинг пока пуст</p>;

  return (
    <ol className="grid gap-0.5">
      {board.data.map((e) => {
        const mine = e.subjectId === highlightId;
        return (
          <li
            key={e.subjectId}
            className={cn('flex items-center gap-3 rounded-md px-2 py-1.5 text-sm', mine && 'bg-accent text-accent-foreground font-medium')}
          >
            <span className={cn('w-5 text-right tabular-nums', !mine && 'text-muted-foreground')}>{e.rank}</span>
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="tabular-nums">{e.total}</span>
          </li>
        );
      })}
    </ol>
  );
}
