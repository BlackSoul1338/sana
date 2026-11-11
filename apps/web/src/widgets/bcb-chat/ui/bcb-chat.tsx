import { useMutationState } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { TurnComposer } from '@/features/challenge-dialog';
import type { Draft } from '@/entities/draft';
import { CARD_FIELDS } from '@/shared/config';
import { cn } from '@/shared/lib/utils';

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={cn('flex', role === 'user' && 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line',
          role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="bg-muted flex w-fit gap-1 rounded-2xl rounded-bl-md px-4 py-3" aria-label="Ассистент думает">
      {[0, 150, 300].map((d) => (
        <span key={d} className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" style={{ animationDelay: `${d}ms` }} />
      ))}
    </div>
  );
}

export function BcbChat({ draft, readonly }: { draft: Draft; readonly?: boolean }) {
  const pending = useMutationState({
    filters: { mutationKey: ['turn', draft.id], status: 'pending' },
    select: (m) => m.state.variables as string,
  });
  const questions = draft.latest?.questions ?? [];
  // The last assistant message already lists the questions; show them as structured hints instead.
  const lastAssistant = draft.messages.findLastIndex((m) => m.role === 'assistant');
  const messages = draft.messages.filter((_, i) => !(i === lastAssistant && questions.length > 0));
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [draft.messages.length, pending.length]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.text}
          </Bubble>
        ))}
        {pending.map((text, i) => (
          <Bubble key={`p${i}`} role="user">
            {text}
          </Bubble>
        ))}
        {pending.length > 0 ? (
          <Typing />
        ) : (
          questions.length > 0 && (
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 text-sm">
              <p className="text-muted-foreground mb-2">Чтобы команды поняли задачу, уточните:</p>
              <ol className="grid gap-2">
                {questions.map((q, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary font-medium tabular-nums">{i + 1}.</span>
                    <span>
                      {q.text}
                      <span className="text-muted-foreground block text-xs">{CARD_FIELDS[q.field].label}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )
        )}
        <div ref={end} />
      </div>
      {!readonly && draft.status !== 'published' && (
        <div className="sticky bottom-4">
          <TurnComposer draftId={draft.id} turnsLeft={draft.latest?.turnsLeft ?? 0} warnReset={draft.status === 'composed'} />
        </div>
      )}
    </div>
  );
}
