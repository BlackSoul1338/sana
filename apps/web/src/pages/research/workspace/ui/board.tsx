import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { researchKeys, type ResearchItem, type ResearchWorkspace } from '@/entities/research';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';
import { Status } from '@/shared/ui/status';
import { Textarea } from '@/shared/ui/textarea';

const KIND = { argument: 'Аргумент', source: 'Источник', question: 'Вопрос' } as const;
type Kind = keyof typeof KIND;

function ItemRow({ item, byId, names, unsupported }: { item: ResearchItem; byId: Map<string, ResearchItem>; names: Map<string, string>; unsupported: boolean }) {
  return (
    <li className="grid gap-1 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {item.stance && <Status tone={item.stance === 'for' ? 'success' : 'danger'}>{item.stance === 'for' ? 'за' : 'против'}</Status>}
        <span className="text-sm">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{item.text}</a> : item.text}</span>
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
        <span>{names.get(item.createdBy) ?? 'Участник'}</span>
        {item.linkIds.length > 0 && <span>опирается на: {item.linkIds.map((l) => byId.get(l)?.text).filter(Boolean).join('; ')}</span>}
        {unsupported && <Status tone="warning">нет источника</Status>}
      </div>
    </li>
  );
}

function AddItem({ ws }: { ws: ResearchWorkspace }) {
  const [kind, setKind] = useState<Kind>('argument');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [threadId, setThreadId] = useState(ws.threads[0]?.id ?? '');
  const [stance, setStance] = useState<'for' | 'against'>('for');
  const [links, setLinks] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const sources = ws.items.filter((i) => i.kind !== 'question');
  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/research/workspaces/{id}/items', {
          params: { path: { id: ws.id } },
          body: {
            kind,
            text,
            ...(kind === 'source' ? { url } : {}),
            linkIds: kind === 'argument' ? links : [],
            ...(kind === 'argument' ? { stance, ...(threadId ? { threadId } : {}) } : {}),
          },
        }),
      ),
    onSuccess: async () => {
      setText('');
      setUrl('');
      setLinks([]);
      await queryClient.invalidateQueries({ queryKey: researchKeys.all });
    },
  });
  return (
    <form
      className="bg-card grid gap-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <Segmented value={kind} onChange={setKind} options={(Object.keys(KIND) as Kind[]).map((k) => ({ value: k, label: KIND[k] }))} label="Что добавить" />
      <Field label={kind === 'source' ? 'Что это за источник' : kind === 'question' ? 'Открытый вопрос' : 'Утверждение'} htmlFor="it-text">
        <Textarea id="it-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      {kind === 'source' && (
        <Field label="Ссылка" htmlFor="it-url">
          <Input id="it-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </Field>
      )}
      {kind === 'argument' && (
        <>
          <div className="flex flex-wrap gap-4">
            <Segmented value={stance} onChange={setStance} options={[{ value: 'for', label: 'За' }, { value: 'against', label: 'Против' }]} label="Позиция" />
            {ws.threads.length > 0 && (
              <select className="bg-background rounded-md border px-2 text-sm" value={threadId} onChange={(e) => setThreadId(e.target.value)} aria-label="Ветка">
                {ws.threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {sources.length > 0 && (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-sm font-medium">На что опирается</legend>
              {sources.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={links.includes(s.id)} onChange={(e) => setLinks((l) => (e.target.checked ? [...l, s.id] : l.filter((x) => x !== s.id)))} />
                  {s.text}
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
      <FormError message={add.isError ? problemMessage(add.error) : undefined} />
      <div>
        <Button type="submit" size="sm" disabled={text.trim().length < 3 || (kind === 'source' && !url) || add.isPending}>
          Добавить на доску
        </Button>
      </div>
    </form>
  );
}

export function Board({ ws, names, editable }: { ws: ResearchWorkspace; names: Map<string, string>; editable: boolean }) {
  const byId = new Map(ws.items.map((i) => [i.id, i]));
  const unsupported = new Set(ws.argumentMap.threads.flatMap((t) => t.unsupported));
  const noCounter = new Set(ws.argumentMap.noCounterArguments);
  const loose = ws.items.filter((i) => i.kind === 'argument' && !ws.threads.some((t) => t.id === i.threadId));
  const groups = [
    ...ws.threads.map((t) => ({ id: t.id, title: t.title, items: ws.items.filter((i) => i.kind === 'argument' && i.threadId === t.id), warn: noCounter.has(t.id) })),
    ...(loose.length ? [{ id: 'loose', title: 'Без ветки', items: loose, warn: false }] : []),
  ];
  const sources = ws.items.filter((i) => i.kind === 'source');
  const questions = ws.items.filter((i) => i.kind === 'question');
  const row = (i: ResearchItem) => <ItemRow key={i.id} item={i} byId={byId} names={names} unsupported={unsupported.has(i.id)} />;

  return (
    <div className="grid gap-6">
      {groups.map((g) => (
        <section key={g.id}>
          <h3 className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm font-semibold">
            {g.title}
            {g.warn && <Status tone="warning" className="font-normal">нет аргументов против</Status>}
          </h3>
          {g.items.length ? <ul className="divide-y">{g.items.map(row)}</ul> : <p className="text-muted-foreground py-2 text-sm">Аргументов пока нет.</p>}
        </section>
      ))}
      <section>
        <h3 className="text-sm font-semibold">Источники</h3>
        {sources.length ? <ul className="divide-y">{sources.map(row)}</ul> : <p className="text-muted-foreground py-2 text-sm">Аргумент без источника слабее — добавьте данные, на которые опираетесь.</p>}
      </section>
      {questions.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Открытые вопросы</h3>
          <ul className="divide-y">{questions.map(row)}</ul>
        </section>
      )}
      {editable && <AddItem ws={ws} />}
    </div>
  );
}
