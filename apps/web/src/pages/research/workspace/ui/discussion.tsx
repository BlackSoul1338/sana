import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { researchKeys, type ResearchWorkspace } from '@/entities/research';
import { api, problemMessage, unwrap, type Schemas } from '@/shared/api';
import { formatRelative } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

type Message = Schemas['ResearchMessage'];
const POLL_MS = 5000;

/** Messages since the cursor, polled while the tab is visible; messages that arrive after the first load are briefly highlighted. */
function useMessages(workspaceId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const cursor = useRef<string | null>(null);
  const loaded = useRef(false);

  const pull = async () => {
    const page = unwrap(await api.GET('/api/research/workspaces/{id}/messages', { params: { path: { id: workspaceId }, query: cursor.current ? { cursor: cursor.current } : {} } }));
    cursor.current = page.nextCursor;
    if (page.items.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...page.items.filter((m) => !seen.has(m.id))];
    });
    if (loaded.current) setFresh(new Set(page.items.map((m) => m.id)));
    loaded.current = true;
  };

  useEffect(() => {
    let stop = false;
    const tick = () => {
      if (!stop && document.visibilityState === 'visible') void pull().catch(() => undefined);
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return { messages, fresh, pull };
}

export function Discussion({ ws, names, editable }: { ws: ResearchWorkspace; names: Map<string, string>; editable: boolean }) {
  const { messages, fresh, pull } = useMessages(ws.id);
  const [threadId, setThreadId] = useState(ws.threads[0]?.id ?? null);
  const [text, setText] = useState('');
  const [newThread, setNewThread] = useState('');
  const queryClient = useQueryClient();
  const active = threadId ?? ws.threads[0]?.id ?? null;
  const shown = messages.filter((m) => m.threadId === active);

  const send = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/research/threads/{id}/messages', { params: { path: { id: active! } }, body: { text } })),
    onSuccess: async () => {
      setText('');
      await pull();
    },
  });
  const addThread = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/research/workspaces/{id}/threads', { params: { path: { id: ws.id } }, body: { title: newThread } })),
    onSuccess: async (t) => {
      setNewThread('');
      setThreadId(t.id);
      await queryClient.invalidateQueries({ queryKey: researchKeys.all });
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ветки обсуждения">
        {ws.threads.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === active}
            onClick={() => setThreadId(t.id)}
            className={cn('rounded-md border px-3 py-1.5 text-sm transition-colors', t.id === active ? 'border-foreground/30 bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.title}
          </button>
        ))}
      </div>
      {editable && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newThread.trim().length >= 3) addThread.mutate();
          }}
        >
          <Input value={newThread} onChange={(e) => setNewThread(e.target.value)} placeholder="Новая гипотеза или вопрос для обсуждения" aria-label="Название новой ветки" />
          <Button type="submit" variant="outline" disabled={newThread.trim().length < 3 || addThread.isPending}>
            Открыть ветку
          </Button>
        </form>
      )}

      {active === null ? (
        <p className="text-muted-foreground text-sm">Веток пока нет. Начните с гипотезы, которую команда хочет проверить.</p>
      ) : (
        <>
          <ol className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1" aria-live="polite">
            {shown.length === 0 && <li className="text-muted-foreground text-sm">В этой ветке ещё нет сообщений.</li>}
            {shown.map((m) => (
              <li key={m.id} className={cn('rounded-md px-3 py-2 transition-colors duration-1000', fresh.has(m.id) ? 'bg-primary/10' : 'bg-muted/40')}>
                <div className="text-muted-foreground flex justify-between gap-4 text-xs">
                  <span className="text-foreground font-medium">{names.get(m.authorId) ?? 'Участник'}</span>
                  <time dateTime={m.createdAt}>{formatRelative(m.createdAt)}</time>
                </div>
                <p className="mt-0.5 text-sm">{m.text}</p>
              </li>
            ))}
          </ol>
          {editable && (
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) send.mutate();
              }}
            >
              <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение в ветку. Баллов не даёт — для выводов добавляйте аргументы на доску." aria-label="Сообщение" />
              <FormError message={send.isError ? problemMessage(send.error) : undefined} />
              <div>
                <Button type="submit" size="sm" disabled={!text.trim() || send.isPending}>
                  Отправить
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
