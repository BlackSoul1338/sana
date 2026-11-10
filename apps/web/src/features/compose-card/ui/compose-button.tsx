import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { draftKeys } from '@/entities/draft';
import { ApiProblem, api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';

export function ComposeButton({ draftId, ready, onComposed }: { draftId: string; ready: boolean; onComposed: (warnings: string[]) => void }) {
  const queryClient = useQueryClient();
  const compose = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/bcb/drafts/{id}/compose', { params: { path: { id: draftId } } })),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: draftKeys.detail(draftId) });
      onComposed(r.warnings);
    },
    onError: (e) => {
      if (e instanceof ApiProblem && e.code === 'sensitive_data') {
        const findings = (e.problem.details?.findings as { excerpt: string; where: string }[] | undefined) ?? [];
        toast.error('Уберите персональные данные', {
          description: findings.map((f) => `${f.where}: ${f.excerpt}`).join('\n') || e.message,
          duration: 10_000,
        });
      } else toast.error(problemMessage(e));
    },
  });

  return (
    <Button variant={ready ? 'default' : 'outline'} className="w-full" disabled={compose.isPending} onClick={() => compose.mutate()}>
      <Wand2 />
      {compose.isPending ? 'Собираем карточку…' : 'Собрать карточку'}
    </Button>
  );
}
