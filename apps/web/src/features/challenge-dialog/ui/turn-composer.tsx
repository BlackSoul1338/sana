import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { draftKeys } from '@/entities/draft';
import { ApiProblem, api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

function useSendTurn(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['turn', draftId],
    mutationFn: async (text: string) =>
      unwrap(await api.POST('/api/bcb/drafts/{id}/turns', { params: { path: { id: draftId } }, body: { text } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: draftKeys.detail(draftId) }),
    onError: (e) => {
      if (e instanceof ApiProblem && e.code === 'turn_limit') toast.error('Ходы закончились — соберите карточку из того, что есть');
      else toast.error(problemMessage(e));
    },
  });
}

export function TurnComposer({ draftId, turnsLeft, warnReset }: { draftId: string; turnsLeft: number; warnReset?: boolean }) {
  const [text, setText] = useState('');
  const send = useSendTurn(draftId);
  const disabled = send.isPending || turnsLeft <= 0;

  const submit = () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    send.mutate(value, { onError: () => setText(value) });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="bg-card focus-within:border-ring/60 rounded-lg border p-2 transition-colors">
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        placeholder={turnsLeft > 0 ? 'Ответьте своими словами — можно на несколько вопросов сразу' : 'Ходы закончились'}
        aria-label="Ответ"
        disabled={disabled}
        className="min-h-0 resize-none border-none p-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-muted-foreground px-1 text-xs">
          {warnReset ? `Новый ответ пересоберёт карточку заново. Осталось ходов: ${turnsLeft}` : `Осталось ходов: ${turnsLeft}`}
        </span>
        <Button size="icon-sm" onClick={submit} disabled={disabled || !text.trim()} aria-label="Отправить">
          <ArrowUp />
        </Button>
      </div>
    </div>
  );
}
