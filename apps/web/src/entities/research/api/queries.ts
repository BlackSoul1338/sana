import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const researchKeys = { all: ['research'] as const };

export const researchTasksQuery = queryOptions({
  queryKey: ['research', 'tasks'],
  queryFn: async () => unwrap(await api.GET('/api/research/tasks')),
});

export const workspacesQuery = (query: { taskId?: string; teamId?: string } = {}) =>
  queryOptions({
    queryKey: ['research', 'workspaces', query],
    queryFn: async () => unwrap(await api.GET('/api/research/workspaces', { params: { query } })),
  });

export const workspaceQuery = (id: string) =>
  queryOptions({
    queryKey: ['research', 'workspace', id],
    queryFn: async () => unwrap(await api.GET('/api/research/workspaces/{id}', { params: { path: { id } } })),
  });

export const workspaceByEvidenceQuery = (evidenceId: string) =>
  queryOptions({
    queryKey: ['research', 'by-evidence', evidenceId],
    queryFn: async () => unwrap(await api.GET('/api/research/evidence/{id}/workspace', { params: { path: { id: evidenceId } } })),
  });
