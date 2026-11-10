import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { projectsQuery } from '@/entities/project';
import { tasksInfiniteQuery, TaskMeta } from '@/entities/task';
import { STAGE_TITLES } from '@/shared/config';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, SectionTitle, Status } from '@/shared/ui/status';

export function BusinessTasksPage() {
  const tasks = useInfiniteQuery(tasksInfiniteQuery({ mine: true }));
  const projects = useQuery(projectsQuery());
  const items = tasks.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="grid gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Мои задачи</h1>
          <p className="text-muted-foreground mt-1">Отклики команд и подтверждённый прогресс по вашим задачам.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/builder/new">
            <Plus />
            Новая задача
          </Link>
        </Button>
      </header>

      <section>
        <SectionTitle>Опубликованные</SectionTitle>
        {tasks.isPending ? (
          <Skeleton className="h-32" />
        ) : items.length === 0 ? (
          <EmptyState title="Пока ни одной" text="Соберите карточку в конструкторе — и команды смогут откликнуться." />
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {items.map((t) => (
              <li key={t.id}>
                <Link to="/tasks/$taskId" params={{ taskId: t.id }} className="hover:bg-muted/50 flex items-center gap-4 px-4 py-3 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.title}</div>
                    <TaskMeta topic={t.topic} difficulty={t.difficulty} estHours={t.estHours} />
                  </div>
                  <Status tone={t.status === 'published' ? 'success' : 'neutral'}>{t.status === 'published' ? 'в каталоге' : t.status}</Status>
                  <span className="text-muted-foreground w-24 text-right text-sm tabular-nums">готовность {t.readiness}%</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Команды в работе</SectionTitle>
        {projects.isPending ? (
          <Skeleton className="h-24" />
        ) : projects.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">Примите заявку — и здесь появится прогресс команды.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.data?.map((p) => (
              <li key={p.id}>
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="bg-card hover:border-primary/40 grid gap-3 rounded-lg border p-4 transition-colors">
                  <div>
                    <div className="font-medium">{p.teamName}</div>
                    <div className="text-muted-foreground text-sm">{p.title}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1" aria-hidden>
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={i < p.approvedStages ? 'bg-success h-1.5 w-5 rounded-full' : 'bg-border h-1.5 w-5 rounded-full'} />
                      ))}
                    </div>
                    <span className="text-muted-foreground text-xs">{p.currentStage ? STAGE_TITLES[p.currentStage] : 'Завершён'}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
