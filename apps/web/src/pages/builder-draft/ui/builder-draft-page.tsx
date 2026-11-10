import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { ComposeButton } from '@/features/compose-card';
import { CardEditor, type CardEditorHandle } from '@/features/edit-card';
import { PublishButton } from '@/features/publish-card';
import { draftQuery, type Draft } from '@/entities/draft';
import { CARD_FIELD_ORDER, CARD_FIELDS } from '@/shared/config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { BcbChat } from '@/widgets/bcb-chat';
import { LiveCard } from '@/widgets/card-preview';
import { ReadinessDiff } from '@/widgets/readiness-diff';

function Back() {
  return (
    <Link to="/builder" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
      <ArrowLeft className="size-4" />
      Черновики
    </Link>
  );
}

function Collecting({ draft, onComposed }: { draft: Draft; onComposed: (w: string[]) => void }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="grid content-start gap-6">
        <Back />
        <h1 className="text-2xl font-semibold">Уточняем задачу</h1>
        <BcbChat draft={draft} />
      </div>
      <aside className="lg:sticky lg:top-20 lg:self-start">
        {draft.latest && (
          <LiveCard
            turn={draft.latest}
            footer={<ComposeButton draftId={draft.id} ready={draft.latest.readyToCompose} onComposed={onComposed} />}
          />
        )}
      </aside>
    </div>
  );
}

function ReadonlyCard({ draft }: { draft: Draft }) {
  return (
    <dl className="grid gap-5">
      {CARD_FIELD_ORDER.map((k) => (
        <div key={k}>
          <dt className="text-muted-foreground text-sm">{CARD_FIELDS[k].label}</dt>
          <dd className="mt-0.5 whitespace-pre-line">{draft.card?.[k].text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BuilderDraftPage({ draftId }: { draftId: string }) {
  const { data: draft } = useSuspenseQuery(draftQuery(draftId));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tab, setTab] = useState('card');
  const editor = useRef<CardEditorHandle>(null);

  if (draft.status === 'collecting') return <Collecting draft={draft} onComposed={setWarnings} />;

  const published = draft.status === 'published';
  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <Back />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Готовность {draft.readiness}%</p>
          <h1 className="text-2xl font-semibold">{draft.card?.title.text}</h1>
        </div>
        {published ? (
          <span className="text-success inline-flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            Опубликована
            {draft.taskId && (
              <Link to="/tasks/$taskId" params={{ taskId: draft.taskId }} className="text-primary ml-2 font-normal">
                Отклики →
              </Link>
            )}
          </span>
        ) : (
          <PublishButton
            draftId={draft.id}
            readiness={draft.readiness}
            beforePublish={async () => {
              setTab('card');
              return (await editor.current?.saveIfDirty()) ?? true;
            }}
          />
        )}
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="card">Карточка</TabsTrigger>
          <TabsTrigger value="diff">До и после</TabsTrigger>
          <TabsTrigger value="chat">Диалог</TabsTrigger>
        </TabsList>
        <TabsContent value="card" forceMount className="mt-6 data-[state=inactive]:hidden">
          {published ? <ReadonlyCard draft={draft} /> : <CardEditor ref={editor} draft={draft} warnings={warnings} />}
        </TabsContent>
        <TabsContent value="diff" className="mt-6">
          <ReadinessDiff draftId={draft.id} />
        </TabsContent>
        <TabsContent value="chat" className="mt-6">
          <BcbChat draft={draft} readonly={published} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
