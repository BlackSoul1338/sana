import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { applicationKeys } from '@/entities/application';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';

export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const withdraw = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/match/applications/{id}/withdraw', { params: { path: { id: applicationId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
    onError: (e) => toast.error(problemMessage(e)),
  });
  return (
    <Button variant="ghost" size="xs" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
      Отозвать
    </Button>
  );
}
