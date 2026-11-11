import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ApplyForm } from '@/features/apply-to-task';
import { applicationsQuery, ApplicationStatus } from '@/entities/application';
import { fitQuery, FitScore, SkillChips } from '@/entities/recommendation';
import { taskQuery, TaskMeta } from '@/entities/task';
import { useActiveTeam } from '@/entities/viewer';
import { CARD_FIELD_ORDER, CARD_FIELDS } from '@/shared/config';
import { Skeleton } from '@/shared/ui/skeleton';
import { SectionTitle } from '@/shared/ui/status';

const COMPONENTS = { skills: 'Навыки', difficulty: 'Сложность', time: 'Время', interest: 'Интересы' } as const;

function FitPanel({ taskId, teamId, teamName }: { taskId: string; teamId: string; teamName: string }) {
  const fit = useQuery(fitQuery(taskId, teamId));
  const apps = useQuery(applicationsQuery({ teamId }));
  const navigate = useNavigate();
  const existing = apps.data?.find((a) => a.taskId === taskId && (a.status === 'pending' || a.status === 'accepted'));

  if (fit.isPending) return <Skeleton className="h-64" />;
  if (fit.isError) return null;
  const f = fit.data;

  return (
    <div className="bg-card grid gap-5 rounded-xl border p-5">
      <div className="flex items-center gap-4">
        <FitScore score={f.score} size={64} />
        <div>
          <div className="font-medium">Совпадение с «{teamName}»</div>
          <div className="text-muted-foreground text-sm">Подбор — подсказка, решение за вами</div>
        </div>
      </div>
      <dl className="grid gap-2">
        {(Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[]).map((k) => (
          <div key={k} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-sm">
            <dt className="text-muted-foreground">{COMPONENTS[k]}</dt>
            <dd className="bg-muted h-1.5 rounded-full">
              <div className="bg-foreground/70 h-full rounded-full" style={{ width: `${f.components[k] * 100}%` }} />
            </dd>
          </div>
        ))}
      </dl>
      <SkillChips matched={f.matched} gaps={f.gaps} max={12} />
      {f.reasons.length > 0 && (
        <ul className="text-muted-foreground grid list-disc gap-1 pl-4 text-sm">
          {f.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <div className="border-t pt-5">
        {existing ? (
          <div className="flex items-center justify-between text-sm">
            Заявка отправлена
            <ApplicationStatus status={existing.status} />
          </div>
        ) : (
          <ApplyForm teamId={teamId} taskId={taskId} onApplied={() => void navigate({ to: '/applications' })} />
        )}
      </div>
    </div>
  );
}

export function ChallengePage({ taskId }: { taskId: string }) {
  const { data: task } = useSuspenseQuery(taskQuery(taskId));
  const { team } = useActiveTeam();

  return (
    <div className="grid gap-8">
      <Link to="/challenges" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Задачи бизнеса
      </Link>
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <article className="grid content-start gap-8">
          <header>
            <h1 className="text-2xl font-semibold sm:text-3xl">{task.title}</h1>
            <div className="mt-2">
              <TaskMeta orgName={task.ownerOrgName} topic={task.topic} difficulty={task.difficulty} estHours={task.estHours} />
            </div>
            <p className="mt-4 text-lg">{task.summary}</p>
          </header>
          {task.card && (
            <dl className="grid gap-6">
              {CARD_FIELD_ORDER.filter((k) => k !== 'title').map((k) => (
                <div key={k}>
                  <dt className="text-muted-foreground text-sm">{CARD_FIELDS[k].label}</dt>
                  <dd className="mt-1 whitespace-pre-line">
                    {task.card![k].source === 'not_specified' ? <span className="text-muted-foreground">Не указано — уточните у компании</span> : task.card![k].text}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <section>
            <SectionTitle>Готовность карточки</SectionTitle>
            <p className="text-muted-foreground text-sm">{task.readiness}% — насколько полно компания описала задачу.</p>
          </section>
        </article>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {team ? <FitPanel taskId={task.id} teamId={team.id} teamName={team.name} /> : <p className="text-muted-foreground text-sm">Создайте команду, чтобы откликнуться.</p>}
        </aside>
      </div>
    </div>
  );
}
