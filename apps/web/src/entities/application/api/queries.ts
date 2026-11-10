import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const applicationKeys = { all: ['applications'] as const };

export const applicationsQuery = (q: { teamId?: string; taskId?: string }) =>
  queryOptions({
    queryKey: ['applications', q],
    queryFn: async () => unwrap(await api.GET('/api/match/applications', { params: { query: q } })),
  });
