import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { draftsQuery, ReadinessMeter } from '@/entities/draft';
import { formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, Status } from '@/shared/ui/status';

const STATUS = {
  collecting: { tone: 'warning', label: 'Уточняем' },
  composed: { tone: 'primary', label: 'Готова к публикации' },
  published: { tone: 'success', label: 'Опубликована' },
} as const;

export function BuilderDraftsPage() {
  const drafts = useQuery(draftsQuery);
  const newButton = (
    <Button asChild>
      <Link to="/builder/new">
        <Plus />
        Новая задача
      </Link>
    </Button>
  );

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Конструктор задач</h1>
          <p className="text-muted-foreground mt-1 max-w-xl">Опишите проблему как есть — ассистент задаст вопросы и соберёт понятную карточку для студентов.</p>
        </div>
        {drafts.data && drafts.data.length > 0 && newButton}
      </header>
      {drafts.isPending ? (
        <Skeleton className="h-40" />
      ) : drafts.data?.length === 0 ? (
        <EmptyState title="Черновиков пока нет" text="Начните с пары предложений о том, что мешает бизнесу." action={newButton} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {drafts.data?.map((d) => (
            <li key={d.id}>
              <Link to="/builder/$draftId" params={{ draftId: d.id }} className="bg-card hover:border-primary/40 flex h-full flex-col gap-4 rounded-lg border p-5 transition-colors">
                <p className="line-clamp-2 text-sm">{d.preview}</p>
                <div className="mt-auto grid gap-2">
                  <ReadinessMeter value={d.readiness} size="sm" />
                  <div className="flex items-center justify-between">
                    <Status tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Status>
                    <span className="text-muted-foreground text-xs">
                      {d.readiness}% · {formatRelative(d.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
