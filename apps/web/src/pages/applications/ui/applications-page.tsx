import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { WithdrawButton } from '@/features/withdraw-application';
import { applicationsQuery, ApplicationStatus } from '@/entities/application';
import { projectsQuery } from '@/entities/project';
import { FitScore } from '@/entities/recommendation';
import { useActiveTeam } from '@/entities/viewer';
import { formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { SubNav } from '@/shared/ui/sub-nav';
import { EmptyState } from '@/shared/ui/status';

const CHALLENGES_NAV = [
  { to: '/challenges', label: 'Каталог' },
  { to: '/applications', label: 'Мои заявки' },
] as const;

export function ApplicationsPage() {
  const { team } = useActiveTeam();
  const apps = useQuery({ ...applicationsQuery({ teamId: team?.id }), enabled: !!team });
  const projects = useQuery({ ...projectsQuery(team?.id), enabled: !!team });
  const projectFor = (taskId: string) => projects.data?.find((p) => p.challengeTaskId === taskId);

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Задачи бизнеса</h1>
        <p className="text-muted-foreground mt-1">Принятая задача появится в трекере спринта.</p>
        <div className="mt-5">
          <SubNav items={CHALLENGES_NAV} label="Задачи бизнеса" />
        </div>
      </header>
      {!team ? (
        <EmptyState title="Нет команды" />
      ) : apps.isPending ? (
        <Skeleton className="h-40" />
      ) : apps.data?.length === 0 ? (
        <EmptyState
          title="Заявок пока нет"
          action={
            <Button asChild variant="outline">
              <Link to="/challenges">Подобрать задачу</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {apps.data?.map((a) => {
            const project = a.status === 'accepted' ? projectFor(a.taskId) : undefined;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <FitScore score={a.score} size={40} />
                <div className="min-w-0 flex-1">
                  <Link to="/challenges/$taskId" params={{ taskId: a.taskId }} className="font-medium hover:underline">
                    {a.taskTitle}
                  </Link>
                  <div className="text-muted-foreground text-xs">{formatRelative(a.createdAt)}</div>
                  {a.decisionComment && <p className="mt-1 text-sm">«{a.decisionComment}»</p>}
                </div>
                <div className="flex basis-full items-center gap-4 pl-14 sm:basis-auto sm:pl-0">
                  <ApplicationStatus status={a.status} />
                  {a.status === 'pending' && <WithdrawButton applicationId={a.id} />}
                  {project && (
                    <Button asChild size="xs" variant="outline">
                      <Link to="/sprint/$projectId" params={{ projectId: project.id }}>
                        В трекер
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
