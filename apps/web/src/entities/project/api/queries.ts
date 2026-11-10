import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const projectKeys = {
  all: ['projects'] as const,
  list: (teamId?: string) => ['projects', 'list', teamId ?? 'all'] as const,
  detail: (id: string) => ['projects', id] as const,
  feed: (id: string) => ['projects', id, 'feed'] as const,
  nextStep: (id: string) => ['projects', id, 'next-step'] as const,
};

export const projectsQuery = (teamId?: string) =>
  queryOptions({
    queryKey: projectKeys.list(teamId),
    queryFn: async () => unwrap(await api.GET('/api/sprint/projects', { params: { query: teamId ? { teamId } : {} } })),
  });

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.detail(id),
    queryFn: async () => unwrap(await api.GET('/api/sprint/projects/{id}', { params: { path: { id } } })),
  });

export const feedQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.feed(id),
    queryFn: async () => unwrap(await api.GET('/api/sprint/projects/{id}/feed', { params: { path: { id } } })),
  });

export const nextStepQuery = (id: string) =>
  queryOptions({
    queryKey: projectKeys.nextStep(id),
    queryFn: async () => unwrap(await api.GET('/api/sprint/projects/{id}/next-step', { params: { path: { id } } })),
    staleTime: 5 * 60_000,
  });

export const templatesQuery = queryOptions({
  queryKey: ['sprint-templates'],
  queryFn: async () => unwrap(await api.GET('/api/sprint/templates')),
  staleTime: Infinity,
});
