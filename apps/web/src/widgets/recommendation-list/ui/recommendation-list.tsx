import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { TrendingUp } from 'lucide-react';
import { FitScore, recommendationsQuery, SkillChips } from '@/entities/recommendation';
import { TaskMeta } from '@/entities/task';
import { plural } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, SectionTitle } from '@/shared/ui/status';

export function RecommendationList({ teamId }: { teamId: string }) {
  const rec = useQuery(recommendationsQuery(teamId));
  if (rec.isPending) return <Skeleton className="h-72" />;
  if (rec.isError) return <p className="text-destructive text-sm">Не удалось подобрать задачи</p>;
  const { items, growth } = rec.data;
  const toAdd = growth.skillsToAdd.filter((s) => s.unlocks > 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
      <section>
        <SectionTitle>Подходят вашей команде</SectionTitle>
        {items.length === 0 ? (
          <EmptyState title="Пока нечего предложить" text="Добавьте навыки команды — подбор станет точнее." />
        ) : (
          <ol className="grid gap-3">
            {items.map((r) => (
              <li key={r.taskId}>
                <Link
                  to="/challenges/$taskId"
                  params={{ taskId: r.taskId }}
                  className="bg-card hover:border-primary/40 flex gap-4 rounded-lg border p-4 transition-colors"
                >
                  <FitScore score={r.fit.score} />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <div>
                      <h3 className="font-medium">{r.title}</h3>
                      <TaskMeta orgName={r.orgName} topic={r.topic} difficulty={r.difficulty} estHours={r.estHours} />
                    </div>
                    <SkillChips matched={r.fit.matched} gaps={r.fit.gaps} />
                    {r.fit.reasons[0] && <p className="text-muted-foreground text-sm">{r.fit.reasons[0]}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
      {toAdd.length > 0 && (
        <aside>
          <SectionTitle>Чтобы расти</SectionTitle>
          <p className="text-muted-foreground mb-3 text-sm">Этих навыков не хватает для задач посложнее:</p>
          <ul className="grid gap-2">
            {toAdd.map((s) => (
              <li key={s.slug} className="flex items-center gap-2 text-sm">
                <TrendingUp className="text-primary size-4" />
                <span className="flex-1">{s.title}</span>
                <span className="text-muted-foreground text-xs">
                  откроет {s.unlocks} {plural(s.unlocks, ['задачу', 'задачи', 'задач'])}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
