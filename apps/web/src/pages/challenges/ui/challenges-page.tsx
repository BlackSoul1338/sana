import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { tasksInfiniteQuery, TaskMeta, topicsQuery } from '@/entities/task';
import { useActiveTeam } from '@/entities/viewer';
import { DIFFICULTY } from '@/shared/config';
import { Button } from '@/shared/ui/button';
import { Segmented } from '@/shared/ui/segmented';
import { Skeleton } from '@/shared/ui/skeleton';
import { SubNav } from '@/shared/ui/sub-nav';
import { EmptyState, SectionTitle } from '@/shared/ui/status';
import { RecommendationList } from '@/widgets/recommendation-list';

type Diff = 'all' | '1' | '2' | '3';

const CHALLENGES_NAV = [
  { to: '/challenges', label: 'Каталог' },
  { to: '/applications', label: 'Мои заявки' },
] as const;

export function ChallengesPage() {
  const { team } = useActiveTeam();
  const [topic, setTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Diff>('all');
  const catalog = useInfiniteQuery(tasksInfiniteQuery({ topic: topic ?? undefined, difficulty: difficulty === 'all' ? undefined : Number(difficulty) }));
  const topics = useQuery(topicsQuery).data ?? [];
  const items = catalog.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="grid gap-12">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Задачи бизнеса</h1>
        <p className="text-muted-foreground mt-1 max-w-xl">Реальные задачи компаний. Подбор объясняет, почему задача вам подходит и чего не хватает.</p>
        <div className="mt-5">
          <SubNav items={CHALLENGES_NAV} label="Задачи бизнеса" />
        </div>
      </header>

      {team ? (
        <RecommendationList teamId={team.id} />
      ) : (
        <EmptyState title="Подбор работает для команды" text="Создайте команду и укажите навыки — покажем подходящие задачи." />
      )}

      <section>
        <SectionTitle>Все задачи</SectionTitle>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            label="Сложность"
            value={difficulty}
            onChange={setDifficulty}
            options={[{ value: 'all', label: 'Любая' }, ...([1, 2, 3] as const).map((d) => ({ value: String(d) as Diff, label: DIFFICULTY[d] }))]}
          />
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(topic === t ? null : t)}
                aria-pressed={topic === t}
                className={
                  topic === t
                    ? 'bg-foreground text-background rounded-full px-3 py-1 text-sm'
                    : 'text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-sm'
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {catalog.isPending ? (
          <Skeleton className="h-48" />
        ) : items.length === 0 ? (
          <EmptyState title="Ничего не нашли" text="Попробуйте другую тему или сложность." />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {items.map((t) => (
              <li key={t.id}>
                <Link to="/challenges/$taskId" params={{ taskId: t.id }} className="hover:bg-muted/50 grid gap-1 px-4 py-3 transition-colors">
                  <span className="font-medium">{t.title}</span>
                  <TaskMeta orgName={t.ownerOrgName} topic={t.topic} difficulty={t.difficulty} estHours={t.estHours} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {catalog.hasNextPage && (
          <Button variant="ghost" className="mt-3" disabled={catalog.isFetchingNextPage} onClick={() => void catalog.fetchNextPage()}>
            Показать ещё
          </Button>
        )}
      </section>
    </div>
  );
}
