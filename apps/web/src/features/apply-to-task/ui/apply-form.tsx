import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { applicationKeys } from '@/entities/application';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { FormError } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';

export function ApplyForm({ teamId, taskId, onApplied }: { teamId: string; taskId: string; onApplied: () => void }) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const apply = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/match/applications', { body: { teamId, taskId, message: message.trim() } })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
      ]);
      onApplied();
    },
  });

  return (
    <div className="grid gap-3">
      <Textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Пара слов бизнесу: почему вы и как планируете подойти"
        aria-label="Сообщение бизнесу"
      />
      <FormError message={apply.error ? problemMessage(apply.error) : undefined} />
      <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
        {apply.isPending ? 'Отправляем…' : 'Откликнуться'}
      </Button>
      <p className="text-muted-foreground text-xs">Это не назначение: работа начнётся, когда бизнес примет заявку.</p>
    </div>
  );
}
