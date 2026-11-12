import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { draftKeys } from '@/entities/draft';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { FormError } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';

const EXAMPLE = 'Например: «Утром в кофейнях длинные очереди, гости уходят. Хотим понять, как ускорить выдачу заказов в часы пик».';

/** Ready-made starts from the test set (data/bcb-descriptions.json): a weak one shows the most questions. */
const SAMPLES = [
  { label: 'Коротко', text: 'Клиенты жалуются. Нужно приложение.' },
  { label: 'Аптеки', text: 'Мы сеть из 5 аптек в Шымкенте. Часто заканчиваются популярные лекарства, а другие лежат до истечения срока. Хотим понять, сколько чего заказывать.' },
  { label: 'Логистика', text: 'Логистическая компания. Водители тратят много времени на погрузку, хотим сократить простои на складе. Есть журнал рейсов в 1С.' },
];

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
      {!text && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Попробовать на примере:</span>
          {SAMPLES.map((s) => (
            <Button key={s.label} type="button" variant="outline" size="xs" onClick={() => setText(s.text)}>
              {s.label}
            </Button>
          ))}
        </div>
      )}
      <FormError message={start.error ? problemMessage(start.error) : undefined} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
