import type { Task } from '@sana/contracts';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api, unwrap } from '@/shared/api';

type Filters = { topic?: string; difficulty?: number; mine?: boolean };

export const taskKeys = { all: ['tasks'] as const };

export const tasksInfiniteQuery = (f: Filters) =>
  infiniteQueryOptions({
    queryKey: ['tasks', 'list', f],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = unwrap(
        await api.GET('/api/tasks', {
          params: { query: { limit: 20, cursor: pageParam, topic: f.topic, difficulty: f.difficulty, mine: f.mine ? 'true' : undefined } },
        }),
      );
      return page as unknown as { items: Task[]; nextCursor: string | null };
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/** Distinct catalog topics; the API has no topic list, so read the largest page it allows. */
export const topicsQuery = queryOptions({
  queryKey: ['tasks', 'topics'],
  queryFn: async () => {
    const page = unwrap(await api.GET('/api/tasks', { params: { query: { limit: 100 } } }));
    return [...new Set(page.items.map((t) => t.topic))].sort();
  },
  staleTime: 5 * 60_000,
});

export const taskQuery = (id: string) =>
  queryOptions({
    queryKey: ['tasks', id],
    // Contract type keeps `card` nullable; the generated one does not.
    queryFn: async () => unwrap(await api.GET('/api/tasks/{id}', { params: { path: { id } } })) as unknown as Task,
  });
