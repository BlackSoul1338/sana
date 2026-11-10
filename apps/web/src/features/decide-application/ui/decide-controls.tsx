import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { applicationKeys } from '@/entities/application';
import { projectKeys } from '@/entities/project';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

export function DecideControls({ applicationId, teamName }: { applicationId: string; teamName: string }) {
  const [comment, setComment] = useState('');
  const [declining, setDeclining] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const decide = useMutation({
    mutationFn: async (decision: 'accept' | 'decline') =>
      unwrap(await api.POST('/api/match/applications/{id}/decision', { params: { path: { id: applicationId } }, body: { decision, comment: comment.trim() } })),
    onSuccess: async (r) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all }),
      ]);
      if (r.application.status === 'accepted' && r.projectId) {
        const projectId = r.projectId;
        toast.success(`Команда «${teamName}» в работе`, {
          description: r.projectCreated ? 'Для неё создан проект в трекере' : 'Задача привязана к её проекту в трекере',
          action: { label: 'Открыть', onClick: () => void navigate({ to: '/projects/$projectId', params: { projectId } }) },
        });
      } else toast('Заявка отклонена');
    },
    onError: (e) => toast.error(problemMessage(e)),
  });

  if (declining) {
    return (
      <div className="grid gap-2">
        <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Что стоит подтянуть команде (увидят они)" autoFocus />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate('decline')}>
            Отклонить
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate('accept')}>
        Принять
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDeclining(true)}>
        Отклонить
      </Button>
    </div>
  );
}
