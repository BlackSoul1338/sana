import { useQuery } from '@tanstack/react-query';
import { CreateTeamForm } from '@/features/create-team';
import { AddMemberPopover, MemberRoleSelect, TeamSkillsEditor } from '@/features/manage-team';
import { teamQuery } from '@/entities/team';
import { useActiveTeam, useMe } from '@/entities/viewer';
import { Skeleton } from '@/shared/ui/skeleton';
import { SectionTitle } from '@/shared/ui/status';

export function TeamPage() {
  const me = useMe();
  const { team: active, setActiveTeam } = useActiveTeam();
  const team = useQuery({ ...teamQuery(active?.id ?? ''), enabled: !!active });

  if (!active) {
    return (
      <div className="grid gap-6">
        <header>
          <h1 className="text-3xl font-semibold">Соберите команду</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">Спринт и задачи бизнеса проходят командой. Создайте её — участников добавите следом.</p>
        </header>
        <CreateTeamForm onCreated={setActiveTeam} />
      </div>
    );
  }
  if (team.isPending) return <Skeleton className="h-64" />;
  if (team.isError) return <p className="text-destructive">Не удалось загрузить команду</p>;
  const t = team.data;

  return (
    <div className="grid max-w-3xl gap-12">
      <header>
        <h1 className="text-3xl font-semibold">{t.name}</h1>
        <p className="text-muted-foreground mt-1">
          {t.weeklyHours} ч в неделю{t.interests.length > 0 && ` · интересы: ${t.interests.join(', ')}`}
        </p>
      </header>

      <section>
        <SectionTitle aside={<AddMemberPopover team={t} />}>Участники</SectionTitle>
        <ul className="divide-y">
          {t.members.map((m) => (
            <li key={m.profileId} className="flex items-center gap-3 py-3">
              <span className="bg-accent text-accent-foreground grid size-8 place-items-center rounded-full text-sm font-medium">
                {m.displayName.slice(0, 1)}
              </span>
              <span className="flex-1">
                {m.displayName}
                {m.profileId === me.profile?.id && <span className="text-muted-foreground"> · вы</span>}
              </span>
              <MemberRoleSelect teamId={t.id} profileId={m.profileId} roleSlug={m.roleSlug} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Навыки</SectionTitle>
        <p className="text-muted-foreground mb-4 text-sm">По ним подбираем задачи бизнеса. Точки — уровень: нажмите, чтобы сменить.</p>
        <TeamSkillsEditor team={t} />
      </section>
    </div>
  );
}
