import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ApiProblem, problemMessage } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';

export function RoutePending() {
  return (
    <div className="grid gap-4" aria-busy>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="mt-6 h-40" />
    </div>
  );
}

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { reset } = useQueryErrorResetBoundary();
  useEffect(() => {
    reset();
  }, [reset]);
  const notFound = error instanceof ApiProblem && error.status === 404;

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">{notFound ? 'Не нашли' : 'Не получилось загрузить'}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{problemMessage(error)}</p>
      <Button variant="outline" className="mt-6" onClick={() => void router.invalidate()}>
        Попробовать ещё раз
      </Button>
    </div>
  );
}
