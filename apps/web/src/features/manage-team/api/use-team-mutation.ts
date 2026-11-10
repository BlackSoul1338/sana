import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { teamQuery, type Team } from '@/entities/team';
import { meQuery } from '@/entities/viewer';
import { problemMessage } from '@/shared/api';

/** Team mutations all return the updated Team: write it to cache instead of refetching. */
export function useTeamMutation<V>(teamId: string, fn: (v: V) => Promise<Team>, success?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (team) => {
      queryClient.setQueryData(teamQuery(teamId).queryKey, team);
      void queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
      if (success) toast.success(success);
    },
    onError: (e) => toast.error(problemMessage(e)),
  });
}
