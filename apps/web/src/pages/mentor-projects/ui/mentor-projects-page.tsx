import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { projectsQuery } from '@/entities/project';
import { STAGE_TITLES } from '@/shared/config';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/status';

export function MentorProjectsPage() {
  const projects = useQuery(projectsQuery());
  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Проекты</h1>
        <p className="text-muted-foreground mt-1">Сроки этапов и поправки баллов — внутри проекта.</p>
      </header>
      {projects.isPending ? (
        <Skeleton className="h-48" />
      ) : projects.data?.length === 0 ? (
        <EmptyState title="Проектов пока нет" />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {projects.data?.map((p) => (
            <li key={p.id}>
              <Link to="/projects/$projectId" params={{ projectId: p.id }} className="hover:bg-muted/50 flex items-center gap-4 px-4 py-3 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-muted-foreground text-sm">{p.teamName}</div>
                </div>
                <div className="flex gap-1" aria-label={`Подтверждено этапов: ${p.approvedStages} из 5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className={i < p.approvedStages ? 'bg-success h-1.5 w-5 rounded-full' : 'bg-border h-1.5 w-5 rounded-full'} />
                  ))}
                </div>
                <span className="text-muted-foreground hidden w-44 text-right text-sm sm:block">
                  {p.currentStage ? STAGE_TITLES[p.currentStage] : 'Завершён'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
