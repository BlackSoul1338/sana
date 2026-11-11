import type { Schemas } from '@/shared/api';
import { RESEARCH_LEVEL, RUBRIC_TITLE } from '@/shared/config';
import { Status, type Tone } from '@/shared/ui/status';

const LEVEL_TONE: Record<keyof typeof RESEARCH_LEVEL, Tone> = { strong: 'success', adequate: 'primary', weak: 'warning' };

/** The submitted conclusion with what each statement rests on, the model's rubric assessment and the position before and after. */
export function ConclusionView({ ws }: { ws: Schemas['ResearchWorkspace'] }) {
  const c = ws.conclusion;
  if (!c) return null;
  const byId = new Map(ws.items.map((i) => [i.id, i]));
  const max = new Map(ws.task.rubric.map((r) => [r.key, r.maxPoints]));
  const a = c.assessment;
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <p className="font-medium">{c.finalPosition}</p>
        <ol className="grid list-decimal gap-3 pl-5">
          {c.statements.map((s, k) => (
            <li key={k} className="text-sm">
              {s.text}
              <ul className="text-muted-foreground mt-1 grid gap-0.5 text-xs">
                {s.itemIds.map((id) => (
                  <li key={id}>{byId.get(id)?.text ?? 'удалённый элемент'}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-xs tabular-nums">
          Источников процитировано: {c.growth.citedSources}, аргументов: {c.growth.citedArguments}, учтено контраргументов: {c.growth.counterArgumentsAddressed}
        </p>
      </section>

      {a ? (
        <>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Оценка по рубрике</h3>
            <ul className="divide-y">
              {a.rubric.map((r) => (
                <li key={r.key} className="grid gap-1 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="text-sm font-medium">
                      {RUBRIC_TITLE[r.key]} <span className="text-muted-foreground font-normal tabular-nums">до {max.get(r.key)}</span>
                    </span>
                    {r.level ? <Status tone={LEVEL_TONE[r.level]}>{RESEARCH_LEVEL[r.level]}</Status> : <Status tone="neutral">не оценено</Status>}
                  </div>
                  {r.explanation && <p className="text-muted-foreground text-sm">{r.explanation}</p>}
                </li>
              ))}
            </ul>
          </section>
          {a.growth && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Позиция до и после</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <blockquote className="bg-muted/40 rounded-md px-3 py-2 text-sm">
                  <span className="text-muted-foreground block text-xs">было</span>«{a.growth.initialQuote}»
                </blockquote>
                <blockquote className="bg-success-soft rounded-md px-3 py-2 text-sm">
                  <span className="text-muted-foreground block text-xs">стало</span>«{a.growth.finalQuote}»
                </blockquote>
              </div>
              <p className="mt-2 text-sm">{a.growth.explanation}</p>
            </section>
          )}
          {a.recommendations.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Что усилить</h3>
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {a.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Модель не оценила вывод — преподаватель оценит его по рубрике сам.</p>
      )}
    </div>
  );
}
