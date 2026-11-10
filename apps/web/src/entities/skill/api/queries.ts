import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const skillsQuery = queryOptions({
  queryKey: ['skills'],
  queryFn: async () => unwrap(await api.GET('/api/skills')),
  staleTime: Infinity,
});
