import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { DecideControls } from '@/features/decide-application';
import { applicationsQuery, ApplicationStatus } from '@/entities/application';
import { projectsQuery } from '@/entities/project';
import { FitScore, SkillChips } from '@/entities/recommendation';
import { taskQuery, TaskMeta } from '@/entities/task';
import { STAGE_TITLES } from '@/shared/config';
import { formatRelative } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, SectionTitle } from '@/shared/ui/status';

export function BusinessTaskPage({ taskId }: { taskId: string }) {
  const { data: task } = useSuspenseQuery(taskQuery(taskId));
  const apps = useQuery(applicationsQuery({ taskId }));
  const projects = useQuery(projectsQuery());
  const working = projects.data?.filter((p) => p.challengeTaskId === taskId) ?? [];
  const pending = apps.data?.filter((a) => a.status === 'pending') ?? [];
  const decided = apps.data?.filter((a) => a.status !== 'pending') ?? [];

  return (
    <div className="grid gap-10">
      <Link to="/tasks" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Мои задачи
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">{task.title}</h1>
        <div className="mt-2">
          <TaskMeta topic={task.topic} difficulty={task.difficulty} estHours={task.estHours} />
        </div>
      </header>

      {working.length > 0 && (
        <section>
          <SectionTitle>В работе</SectionTitle>
          <ul className="grid gap-2">
            {working.map((p) => (
              <li key={p.id}>
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="bg-accent text-accent-foreground flex items-center justify-between rounded-lg px-4 py-3 text-sm">
                  <span className="font-medium">{p.teamName}</span>
                  <span>
                    {p.approvedStages}/5 этапов · {p.currentStage ? STAGE_TITLES[p.currentStage] : 'завершён'} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle aside={pending.length > 0 && <span className="text-muted-foreground text-sm">{pending.length} ждут решения</span>}>Отклики</SectionTitle>
        {apps.isPending ? (
          <Skeleton className="h-32" />
        ) : apps.data?.length === 0 ? (
          <EmptyState title="Откликов пока нет" text="Задача уже в каталоге — команды с подходящими навыками увидят её в рекомендациях." />
        ) : (
          <ul className="grid gap-3">
            {[...pending, ...decided].map((a) => (
              <li key={a.id} className="bg-card grid gap-3 rounded-lg border p-4">
                <div className="flex items-start gap-4">
                  <FitScore score={a.score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{a.teamName}</span>
                      <ApplicationStatus status={a.status} />
                      <span className="text-muted-foreground ml-auto text-xs">{formatRelative(a.createdAt)}</span>
                    </div>
                    {a.message && <p className="mt-1 text-sm">«{a.message}»</p>}
                    <div className="mt-2">
                      <SkillChips matched={a.fit.matched} gaps={a.fit.gaps} />
                    </div>
                  </div>
                </div>
                {a.status === 'pending' && (
                  <div className="pl-16">
                    <DecideControls applicationId={a.id} teamName={a.teamName} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
