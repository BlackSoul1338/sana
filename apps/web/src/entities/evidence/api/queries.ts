import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

type Status = 'pending' | 'approved' | 'rejected' | 'adjusted';

export const evidenceKeys = { all: ['evidence'] as const };

export const evidenceListQuery = (query: { status?: Status; teamId?: string; module?: string }) =>
  queryOptions({
    queryKey: ['evidence', 'list', query],
    queryFn: async () => unwrap(await api.GET('/api/evidence', { params: { query } })),
  });

export const evidenceDetailQuery = (id: string) =>
  queryOptions({
    queryKey: ['evidence', id],
    queryFn: async () => unwrap(await api.GET('/api/evidence/{id}', { params: { path: { id } } })),
  });
