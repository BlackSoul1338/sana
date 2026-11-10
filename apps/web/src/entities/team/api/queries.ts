import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const teamQuery = (id: string) =>
  queryOptions({
    queryKey: ['teams', id],
    queryFn: async () => unwrap(await api.GET('/api/teams/{id}', { params: { path: { id } } })),
  });

export const rolesQuery = queryOptions({
  queryKey: ['team-roles'],
  queryFn: async () => unwrap(await api.GET('/api/roles')),
  staleTime: Infinity,
});
