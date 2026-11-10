import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { draftKeys } from '@/entities/draft';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { FormError } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';

const EXAMPLE = 'Например: «Утром в кофейнях длинные очереди, гости уходят. Хотим понять, как ускорить выдачу заказов в часы пик».';

export function StartDraftForm({ onStarted }: { onStarted: (draftId: string) => void }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/bcb/drafts', { body: { text: text.trim() } })),
    onSuccess: async (turn) => {
      await queryClient.invalidateQueries({ queryKey: draftKeys.all });
      onStarted(turn.draftId);
    },
  });
  const tooShort = text.trim().length < 10;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort) start.mutate();
      }}
    >
      <Textarea
        autoFocus
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        className="text-base"
        aria-label="Описание проблемы"
        disabled={start.isPending}
      />
      <FormError message={start.error ? problemMessage(start.error) : undefined} />
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={tooShort || start.isPending}>
          {start.isPending ? 'Разбираем описание…' : 'Разобрать задачу'}
        </Button>
        <span className="text-muted-foreground text-sm">
          {start.isPending ? 'Это займёт несколько секунд' : 'Не нужно писать идеально — дальше зададим вопросы'}
        </span>
      </div>
    </form>
  );
}
