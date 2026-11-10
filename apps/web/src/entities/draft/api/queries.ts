import { queryOptions } from '@tanstack/react-query';
import type { bcb } from '@sana/contracts';
import { api, unwrap } from '@/shared/api';

export const draftKeys = {
  all: ['drafts'] as const,
  detail: (id: string) => ['drafts', id] as const,
  diff: (id: string) => ['drafts', id, 'diff'] as const,
};

export const draftsQuery = queryOptions({
  queryKey: draftKeys.all,
  queryFn: async () => unwrap(await api.GET('/api/bcb/drafts')),
});

export const draftQuery = (id: string) =>
  queryOptions({
    queryKey: draftKeys.detail(id),
    // Generated types lose nullability of latest/card/requirements (allOf + null in OpenAPI 3.1), so use the contract type.
    queryFn: async () => unwrap(await api.GET('/api/bcb/drafts/{id}', { params: { path: { id } } })) as unknown as bcb.Draft,
  });

export const diffQuery = (id: string) =>
  queryOptions({
    queryKey: draftKeys.diff(id),
    queryFn: async () => unwrap(await api.GET('/api/bcb/drafts/{id}/diff', { params: { path: { id } } })),
  });
