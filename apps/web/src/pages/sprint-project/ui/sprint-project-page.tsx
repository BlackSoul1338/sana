import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Briefcase, Upload } from 'lucide-react';
import { AdjustPointsDialog } from '@/features/adjust-points';
import { StagePlanEditor } from '@/features/plan-stage';
import { SubmitEvidenceDialog } from '@/features/submit-evidence';
import { projectQuery, StageTrack } from '@/entities/project';
import { teamQuery } from '@/entities/team';
import { useMe } from '@/entities/viewer';
import { plural } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { SectionTitle } from '@/shared/ui/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { LeaderboardList } from '@/widgets/leaderboard';
import { NextStepHint } from '@/widgets/next-step-hint';
import { ProjectFeed } from '@/widgets/project-feed';
import { TaskBoard } from '@/widgets/task-board';
import { EvidenceList } from './evidence-list';

export function SprintProjectPage({ projectId, backTo }: { projectId: string; backTo: { to: string; label: string } }) {
  const me = useMe();
  const { data: project } = useSuspenseQuery(projectQuery(projectId));
  const role = me.profile!.role;
  const isMember = me.teams.some((t) => t.id === project.teamId);
  const team = useQuery({ ...teamQuery(project.teamId), enabled: role !== 'business' }).data;
  const members = Object.fromEntries((team?.members ?? []).map((m) => [m.profileId, m.displayName]));
  const canSubmit = role === 'student' && isMember && project.status === 'active';

  return (
    <div className="grid gap-10">
      <header className="grid gap-4">
        <Link to={backTo.to} className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-4" />
          {backTo.label}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              {project.teamName}
              {project.challengeTaskId && (
                <span className="text-accent-foreground inline-flex items-center gap-1">
                  · <Briefcase className="size-3.5" /> задача бизнеса
                </span>
              )}
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{project.title}</h1>
            <p className="text-muted-foreground mt-2">{project.idea}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-semibold tabular-nums">{project.points.team}</div>
            <div className="text-muted-foreground text-sm">{plural(project.points.team, ['балл', 'балла', 'баллов'])} команды</div>
          </div>
        </div>
      </header>

      <section>
        <StageTrack stages={project.stages} />
      </section>

      {role !== 'business' && (
        <NextStepHint
          projectId={project.id}
          action={
            canSubmit && (
              <SubmitEvidenceDialog project={project}>
                <Button size="sm">
                  <Upload />
                  Подтвердить
                </Button>
              </SubmitEvidenceDialog>
            )
          }
        />
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
        <Tabs defaultValue={role === 'business' ? 'evidence' : 'tasks'}>
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              {role !== 'business' && <TabsTrigger value="tasks">Задачи</TabsTrigger>}
              <TabsTrigger value="evidence">Подтверждения</TabsTrigger>
              <TabsTrigger value="feed">Лента</TabsTrigger>
            </TabsList>
            {canSubmit && (
              <SubmitEvidenceDialog project={project} defaultTarget="interview">
                <Button variant="ghost" size="sm">
                  + Интервью
                </Button>
              </SubmitEvidenceDialog>
            )}
          </div>
          {role !== 'business' && (
            <TabsContent value="tasks" className="mt-4">
              <TaskBoard project={project} team={team} editable={isMember || role === 'mentor'} canSubmit={canSubmit} />
            </TabsContent>
          )}
          <TabsContent value="evidence" className="mt-4">
            <EvidenceList project={project} members={members} canFeedback={role === 'business' && !!project.challengeTaskId} />
          </TabsContent>
          <TabsContent value="feed" className="mt-4">
            <ProjectFeed projectId={project.id} members={members} />
          </TabsContent>
        </Tabs>

        <aside className="grid content-start gap-8">
          {role === 'mentor' && (
            <section>
              <SectionTitle
                aside={
                  <AdjustPointsDialog teamId={project.teamId} teamName={project.teamName}>
                    <Button variant="ghost" size="xs">
                      Поправка баллов
                    </Button>
                  </AdjustPointsDialog>
                }
              >
                Сроки этапов
              </SectionTitle>
              <StagePlanEditor project={project} />
            </section>
          )}
          {team && (
            <section>
              <SectionTitle>Вклад участников</SectionTitle>
              <ul className="grid gap-2">
                {team.members.map((m) => (
                  <li key={m.profileId} className="flex items-center justify-between text-sm">
                    <span>{m.displayName}</span>
                    <span className="text-muted-foreground tabular-nums">{project.points.byMember[m.profileId] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <SectionTitle>Рейтинг команд</SectionTitle>
            <LeaderboardList highlightId={project.teamId} />
          </section>
        </aside>
      </div>
    </div>
  );
}
