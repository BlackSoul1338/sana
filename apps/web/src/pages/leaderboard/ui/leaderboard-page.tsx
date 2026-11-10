import { useState } from 'react';
import { useActiveTeam, useMe } from '@/entities/viewer';
import { Segmented } from '@/shared/ui/segmented';
import { LeaderboardList } from '@/widgets/leaderboard';

type Kind = 'team' | 'profile' | 'org';

export function LeaderboardPage() {
  const me = useMe();
  const { team } = useActiveTeam();
  const [kind, setKind] = useState<Kind>(me.profile?.role === 'business' ? 'org' : 'team');
  const highlight = kind === 'team' ? team?.id : kind === 'profile' ? me.profile?.id : (me.profile?.orgId ?? undefined);

  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Рейтинг</h1>
          <p className="text-muted-foreground mt-1">Только подтверждённые баллы — у каждого начисления есть объяснение.</p>
        </div>
        <Segmented
          label="Кого показать"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'team', label: 'Команды' },
            { value: 'profile', label: 'Участники' },
            { value: 'org', label: 'Компании' },
          ]}
        />
      </header>
      <LeaderboardList subjectType={kind} limit={50} highlightId={highlight} />
    </div>
  );
}
