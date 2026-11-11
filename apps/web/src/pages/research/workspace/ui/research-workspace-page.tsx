import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ReturnNote } from '@/entities/evidence';
import { ConclusionView, workspaceQuery } from '@/entities/research';
import { useMe } from '@/entities/viewer';
import { WS_STATUS } from '@/shared/config';
import { points } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/skeleton';
import { SectionTitle, Status } from '@/shared/ui/status';
import { Board } from './board';
import { ConclusionEditor } from './conclusion-editor';
import { Discussion } from './discussion';
import { SummaryPanel } from './summary-panel';
import { TeamPanel } from './team-panel';

export function ResearchWorkspacePage({ workspaceId }: { workspaceId: string }) {
  const me = useMe();
  const { data: ws, isPending } = useQuery(workspaceQuery(workspaceId));
  if (isPending || !ws) return <Skeleton className="h-96" />;

  const editable = me.profile!.role !== 'teacher' && ws.status === 'active';
  const names = new Map(ws.contribution.map((c) => [c.profileId, c.name]));
  const st = WS_STATUS[ws.status];

  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <p className="text-muted-foreground text-sm">
          <Link to="/research" className="hover:text-foreground underline-offset-2 hover:underline">
            Исследования
          </Link>
          <span className="mx-2">/</span>
          {ws.teamName}
        </p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{ws.task.title}</h1>
        <p className="max-w-prose">{ws.task.question}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <Status tone={st.tone}>{st.label}</Status>
          {ws.points > 0 && <span className="font-medium tabular-nums">{points(ws.points)}</span>}
        </div>
        <p className="text-muted-foreground max-w-prose text-sm">Начальная позиция: «{ws.initialPosition}»</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Обсуждение</SectionTitle>
          <Discussion ws={ws} names={names} editable={editable} />
        </section>
        <section>
          <SectionTitle>Доска аргументов</SectionTitle>
          <Board ws={ws} names={names} editable={editable} />
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>Что упущено</SectionTitle>
          <SummaryPanel ws={ws} editable={editable} />
        </section>
        <section>
          <SectionTitle>Команда и вклад</SectionTitle>
          <TeamPanel ws={ws} editable={editable} />
        </section>
      </div>

      <section className="max-w-3xl">
        <SectionTitle>Вывод</SectionTitle>
        {editable ? (
          <>
            {ws.conclusion?.evidenceId && (
              <div className="mb-4">
                <ReturnNote evidenceId={ws.conclusion.evidenceId}>Преподаватель вернул вывод на доработку. Исправьте утверждения и отправьте снова.</ReturnNote>
              </div>
            )}
            <ConclusionEditor ws={ws} />
          </>
        ) : ws.conclusion ? (
          <ConclusionView ws={ws} />
        ) : (
          <p className="text-muted-foreground text-sm">Команда ещё не отправила вывод.</p>
        )}
      </section>
    </div>
  );
}
