import { QueryClient } from '@tanstack/react-query';
import { ApiProblem } from '@/shared/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiProblem && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});
