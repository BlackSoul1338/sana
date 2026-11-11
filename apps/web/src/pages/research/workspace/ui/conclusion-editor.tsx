import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { researchKeys, type ResearchWorkspace } from '@/entities/research';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';

type Statement = { text: string; itemIds: string[] };

/** Every statement must cite at least one argument or source from the board; the server enforces the same rule. */
export function ConclusionEditor({ ws }: { ws: ResearchWorkspace }) {
  const [finalPosition, setFinalPosition] = useState(ws.conclusion?.finalPosition ?? '');
  const [statements, setStatements] = useState<Statement[]>(ws.conclusion?.statements ?? [{ text: '', itemIds: [] }]);
  const queryClient = useQueryClient();
  const citable = ws.items.filter((i) => i.kind !== 'question');
  const submit = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/research/workspaces/{id}/conclusion', { params: { path: { id: ws.id } }, body: { finalPosition, statements } })),
    onSuccess: (data) => queryClient.setQueryData(['research', 'workspace', ws.id], data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: researchKeys.all }),
  });
  const set = (k: number, patch: Partial<Statement>) => setStatements((list) => list.map((s, i) => (i === k ? { ...s, ...patch } : s)));
  const ready = finalPosition.trim().length >= 10 && statements.every((s) => s.text.trim().length >= 5 && s.itemIds.length > 0);

  return (
    <div className="grid gap-5">
      <Field label="Итоговая позиция команды" htmlFor="cc-final">
        <Textarea id="cc-final" rows={3} value={finalPosition} onChange={(e) => setFinalPosition(e.target.value)} />
      </Field>
      <ol className="grid gap-5">
        {statements.map((s, k) => (
          <li key={k} className="grid gap-2 border-l-2 pl-4">
            <div className="flex items-start gap-2">
              <Textarea rows={2} value={s.text} onChange={(e) => set(k, { text: e.target.value })} placeholder={`Утверждение ${k + 1}`} aria-label={`Утверждение ${k + 1}`} />
              {statements.length > 1 && (
                <Button variant="ghost" size="icon" aria-label="Убрать утверждение" onClick={() => setStatements((l) => l.filter((_, i) => i !== k))}>
                  <X />
                </Button>
              )}
            </div>
            <fieldset className="grid gap-1">
              <legend className="text-muted-foreground mb-1 text-xs">Опирается на</legend>
              {citable.map((it) => (
                <label key={it.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={s.itemIds.includes(it.id)}
                    onChange={(e) => set(k, { itemIds: e.target.checked ? [...s.itemIds, it.id] : s.itemIds.filter((x) => x !== it.id) })}
                  />
                  <span>
                    <span className="text-muted-foreground">{it.kind === 'source' ? 'источник' : 'аргумент'}: </span>
                    {it.text}
                  </span>
                </label>
              ))}
              {s.itemIds.length === 0 && <span className="text-muted-foreground text-xs">Без ссылки на доску утверждение не отправить.</span>}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        {statements.length < 12 && (
          <Button variant="outline" size="sm" onClick={() => setStatements((l) => [...l, { text: '', itemIds: [] }])}>
            <Plus />
            Утверждение
          </Button>
        )}
        <Button size="sm" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? 'Модель читает вывод…' : 'Отправить преподавателю'}
        </Button>
      </div>
      <FormError message={submit.isError ? problemMessage(submit.error) : undefined} />
    </div>
  );
}
