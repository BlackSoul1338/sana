import { useQuery } from '@tanstack/react-query';
import { rolesQuery } from '@/entities/team';
import { api, unwrap } from '@/shared/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { useTeamMutation } from '../api/use-team-mutation';

const NONE = '__none';

export function MemberRoleSelect({ teamId, profileId, roleSlug }: { teamId: string; profileId: string; roleSlug: string | null }) {
  const roles = useQuery(rolesQuery);
  const assign = useTeamMutation(teamId, async (slug: string | null) =>
    unwrap(await api.PATCH('/api/teams/{id}/members/{profileId}', { params: { path: { id: teamId, profileId } }, body: { roleSlug: slug } })),
  );

  return (
    <Select value={roleSlug ?? NONE} onValueChange={(v) => assign.mutate(v === NONE ? null : v)}>
      <SelectTrigger size="sm" className="w-44" aria-label="Роль в команде">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Роль не выбрана</SelectItem>
        {roles.data?.map((r) => (
          <SelectItem key={r.slug} value={r.slug}>
            {r.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
