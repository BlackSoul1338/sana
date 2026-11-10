import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Plus } from 'lucide-react';
import { CreateProjectDialog } from '@/features/create-project';
import { projectsQuery } from '@/entities/project';
import { useActiveTeam } from '@/entities/viewer';
import { STAGE_TITLES } from '@/shared/config';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/status';

export function SprintProjectsPage() {
  const { team } = useActiveTeam();
  const navigate = useNavigate();
  const projects = useQuery({ ...projectsQuery(team?.id), enabled: !!team });

  if (!team) {
    return (
      <EmptyState
        title="Сначала команда"
        text="Спринт проходят командой: создайте её или попросите товарища добавить вас."
        action={
          <Button asChild>
            <Link to="/team">К команде</Link>
          </Button>
        }
      />
    );
  }

  const openProject = (id: string) => void navigate({ to: '/sprint/$projectId', params: { projectId: id } });

  return (
    <div className="grid gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">{team.name}</p>
          <h1 className="text-3xl font-semibold">Проекты</h1>
        </div>
        <CreateProjectDialog teamId={team.id} onCreated={openProject}>
          <Button>
            <Plus />
            Новый проект
          </Button>
        </CreateProjectDialog>
      </header>
      {projects.isPending ? (
        <Skeleton className="h-28" />
      ) : projects.data?.length === 0 ? (
        <EmptyState title="Проектов пока нет" text="Опишите идею — и пройдите путь от идеи до тестирования за пять этапов." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.data?.map((p) => (
            <li key={p.id}>
              <Link
                to="/sprint/$projectId"
                params={{ projectId: p.id }}
                className="bg-card hover:border-primary/40 group flex h-full flex-col rounded-lg border p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-semibold">{p.title}</h2>
                  <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 transition-colors" />
                </div>
                <div className="mt-auto flex items-center gap-3 pt-6">
                  <div className="flex gap-1" aria-hidden>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < p.approvedStages ? 'bg-success h-1.5 w-6 rounded-full' : 'bg-border h-1.5 w-6 rounded-full'} />
                    ))}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {p.currentStage ? `Сейчас: ${STAGE_TITLES[p.currentStage]}` : 'Все этапы пройдены'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
