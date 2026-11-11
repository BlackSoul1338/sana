import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

export const practiceKeys = { all: ['practice'] as const };

export const modulesQuery = queryOptions({
  queryKey: ['practice', 'modules'],
  queryFn: async () => unwrap(await api.GET('/api/practice/modules')),
});

export const quizQuery = (moduleId: string) =>
  queryOptions({
    queryKey: ['practice', 'quiz', moduleId],
    queryFn: async () => unwrap(await api.GET('/api/practice/modules/{id}/quiz', { params: { path: { id: moduleId } } })),
  });

export const assignmentsQuery = (moduleId?: string) =>
  queryOptions({
    queryKey: ['practice', 'assignments', moduleId ?? 'all'],
    queryFn: async () => unwrap(await api.GET('/api/practice/assignments', { params: { query: moduleId ? { moduleId } : {} } })),
  });

export const attemptsQuery = (assignmentId: string) =>
  queryOptions({
    queryKey: ['practice', 'attempts', assignmentId],
    queryFn: async () => unwrap(await api.GET('/api/practice/assignments/{id}/attempts', { params: { path: { id: assignmentId } } })),
  });

export const attemptQuery = (id: string) =>
  queryOptions({
    queryKey: ['practice', 'attempt', id],
    queryFn: async () => unwrap(await api.GET('/api/practice/attempts/{id}', { params: { path: { id } } })),
  });

export const dashboardQuery = (moduleId: string) =>
  queryOptions({
    queryKey: ['practice', 'dashboard', moduleId],
    queryFn: async () => unwrap(await api.GET('/api/practice/dashboard', { params: { query: { moduleId } } })),
  });

export const recommendationQuery = queryOptions({
  queryKey: ['practice', 'recommendation'],
  queryFn: async () => unwrap(await api.GET('/api/practice/recommendation')),
});
