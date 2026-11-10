import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const leaderboardQuery = (subjectType: 'team' | 'profile' | 'org' = 'team', limit = 20) =>
  queryOptions({
    queryKey: ['leaderboard', subjectType, limit],
    queryFn: async () => unwrap(await api.GET('/api/leaderboard', { params: { query: { subjectType, limit } } })),
  });
