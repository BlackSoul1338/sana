import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { api, unwrap, type Schemas } from '@/shared/api';

export type Me = Schemas['Me'];
export type Role = Schemas['Role'];

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => unwrap(await api.GET('/api/me')),
  staleTime: 60_000,
});

export function useMe() {
  return useSuspenseQuery(meQuery).data;
}

export const ROLE_HOME: Record<Role, string> = {
  student: '/sprint',
  mentor: '/review',
  business: '/builder',
};

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Студент',
  mentor: 'Ментор',
  business: 'Бизнес',
};
