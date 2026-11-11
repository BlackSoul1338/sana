import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import { ReviewForm } from '@/features/review-evidence';
import { evidenceDetailQuery, evidenceListQuery, EvidenceStatus, type Evidence } from '@/entities/evidence';
import { teamsQuery } from '@/entities/team';
import { EVIDENCE_KIND, EVIDENCE_SUBJECT } from '@/shared/config';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import { Segmented } from '@/shared/ui/segmented';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/status';

type Status = 'pending' | 'approved' | 'rejected';

function EvidenceSheet({ id, teamName, onClose }: { id: string | null; teamName: string; onClose: () => void }) {
  const detail = useQuery({ ...evidenceDetailQuery(id ?? ''), enabled: !!id });
  const e = detail.data;
  const isImage = e?.storagePath && /\.(png|jpe?g|webp)$/i.test(e.storagePath);

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{e ? `${teamName}: ${(EVIDENCE_SUBJECT[e.subjectType] ?? 'подтверждение').toLowerCase()}` : 'Загрузка…'}</SheetTitle>
          {e && (
            <SheetDescription>
              {EVIDENCE_KIND[e.kind]}, {formatDateTime(e.createdAt)}
            </SheetDescription>
          )}
        </SheetHeader>
        {!e ? (
          <Skeleton className="mx-4 h-40" />
        ) : (
          <div className="grid gap-6 px-4 pb-6">
            {e.note && <p className="text-sm whitespace-pre-line">{e.note}</p>}
            {e.url && (
              <a href={e.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1.5 text-sm break-all">
                <ExternalLink className="size-4 shrink-0" />
                {e.url}
              </a>
            )}
            {e.downloadUrl &&
              (isImage ? (
                <a href={e.downloadUrl} target="_blank" rel="noreferrer">
                  <img src={e.downloadUrl} alt="Приложенный скриншот" className="rounded-md border" />
                </a>
              ) : (
                <a href={e.downloadUrl} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1.5 text-sm">
                  <FileText className="size-4" />
                  Открыть файл
                </a>
              ))}
            {e.status === 'pending' ? (
              <div className="border-t pt-6">
                <ReviewForm evidenceId={e.id} onDone={onClose} />
              </div>
            ) : (
              <div className="grid gap-1 border-t pt-4 text-sm">
                <EvidenceStatus status={e.status} />
                {e.reviewComment && <p>{e.reviewComment}</p>}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ReviewQueuePage() {
  const [status, setStatus] = useState<Status>('pending');
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useQuery(evidenceListQuery({ status }));
  const teams = useQuery(teamsQuery);
  const names = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
  const teamName = (e: Evidence) => (e.teamId && names.get(e.teamId)) || 'Команда';
  const opened = list.data?.find((e) => e.id === openId);

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Проверка</h1>
          <p className="text-muted-foreground mt-1">Баллы команды получают только после вашего решения.</p>
        </div>
        <Segmented
          label="Статус"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'pending', label: 'Ждут' },
            { value: 'approved', label: 'Приняты' },
            { value: 'rejected', label: 'Отклонены' },
          ]}
        />
      </header>
      {list.isPending ? (
        <Skeleton className="h-48" />
      ) : list.data?.length === 0 ? (
        <EmptyState title={status === 'pending' ? 'Всё проверено' : 'Пусто'} text={status === 'pending' ? 'Новые подтверждения появятся здесь.' : undefined} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {list.data?.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} className="hover:bg-muted/50 grid w-full gap-1 px-4 py-3 text-left transition-colors">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium">{teamName(e)}</span>
                  <span className="text-muted-foreground">{EVIDENCE_SUBJECT[e.subjectType] ?? 'Подтверждение'}</span>
                  <span className="text-muted-foreground">{EVIDENCE_KIND[e.kind].toLowerCase()}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{formatRelative(e.createdAt)}</span>
                </div>
                {e.note && <p className="text-muted-foreground line-clamp-1 text-sm">{e.note}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <EvidenceSheet id={openId} teamName={opened ? teamName(opened) : ''} onClose={() => setOpenId(null)} />
    </div>
  );
}
