import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResearchWorkspace } from '@/entities/research';
import { api, problemMessage, unwrap } from '@/shared/api';
import { formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { FormError } from '@/shared/ui/field';

/** "What is missing": the model's summary of the discussion. Without the model the code-built argument map on the board still works. */
export function SummaryPanel({ ws, editable }: { ws: ResearchWorkspace; editable: boolean }) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/research/workspaces/{id}/summary', { params: { path: { id: ws.id } } })),
    onSuccess: (data) => queryClient.setQueryData(['research', 'workspace', ws.id], data),
  });
  const s = ws.summary;
  const titleOf = new Map(ws.threads.map((t) => [t.id, t.title]));
  const missing = s ? [...s.threads.flatMap((t) => t.missingArguments.map((m) => ({ key: `${t.threadId}${m}`, text: m, where: titleOf.get(t.threadId) }))), ...s.missingQuestions.map((q) => ({ key: q, text: q, where: 'вопрос' }))] : [];

  return (
    <div className="grid gap-3">
      {s ? (
        <>
          <p className="text-sm">{s.text}</p>
          {missing.length > 0 && (
            <ul className="grid gap-2">
              {missing.map((m) => (
                <li key={m.key} className="bg-warning-soft rounded-md px-3 py-2 text-sm">
                  {m.where && <span className="text-muted-foreground block text-xs">{m.where}</span>}
                  {m.text}
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground text-xs">Сводка от {formatRelative(s.createdAt)}</p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Модель прочитает обсуждение и доску и подскажет, каких аргументов и вопросов не хватает.</p>
      )}
      {editable && (
        <div>
          <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? 'Читаем обсуждение…' : s ? 'Обновить сводку' : 'Найти пробелы'}
          </Button>
        </div>
      )}
      <FormError message={run.isError ? problemMessage(run.error) : undefined} />
    </div>
  );
}
