import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const recommendationsQuery = (teamId: string, f: { topic?: string; difficulty?: number } = {}) =>
  queryOptions({
    queryKey: ['recommendations', teamId, f],
    queryFn: async () => unwrap(await api.GET('/api/match/recommendations', { params: { query: { teamId, limit: 5, ...f } } })),
  });

export const fitQuery = (taskId: string, teamId: string) =>
  queryOptions({
    queryKey: ['fit', taskId, teamId],
    queryFn: async () => unwrap(await api.GET('/api/match/tasks/{id}/fit', { params: { path: { id: taskId }, query: { teamId } } })),
  });
