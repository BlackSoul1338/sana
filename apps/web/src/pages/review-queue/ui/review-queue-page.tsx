import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText } from 'lucide-react';
import { useState } from 'react';
import { ReviewForm } from '@/features/review-evidence';
import { evidenceDetailQuery, evidenceListQuery, EvidenceStatus } from '@/entities/evidence';
import { attemptQuery, CheckResult } from '@/entities/practice';
import { ConclusionView, workspaceByEvidenceQuery } from '@/entities/research';
import { teamsQuery } from '@/entities/team';
import { EVIDENCE_KIND, EVIDENCE_SUBJECT } from '@/shared/config';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import { type Schemas } from '@/shared/api';
import { points } from '@/shared/lib/format';
import { prefersReducedMotion } from '@/shared/lib/motion';
import { cn } from '@/shared/lib/utils';
import { Segmented } from '@/shared/ui/segmented';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState } from '@/shared/ui/status';

type Status = 'pending' | 'approved' | 'rejected';
type QueueItem = Schemas['EvidenceQueueItem'];

function PracticePanel({ attemptId }: { attemptId: string }) {
  const { data: a } = useQuery(attemptQuery(attemptId));
  if (!a) return <Skeleton className="h-40" />;
  const pre = a.preview.correctness + a.preview.completeness + a.preview.selfCorrection + a.preview.completion;
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="text-sm font-medium">{a.assignment.title}</p>
        <p className="text-muted-foreground text-sm">{a.assignment.condition}</p>
      </div>
      <blockquote className="bg-muted/40 rounded-md px-3 py-2 text-sm whitespace-pre-line">{a.answer}</blockquote>
      <CheckResult criteria={a.assignment.criteria} check={a.check} corrected={a.corrected} />
      <p className="text-sm tabular-nums">
        По правилам при принятии: <span className="font-medium">{points(pre)}</span>
        {a.preview.selfCorrection > 0 && <span className="text-muted-foreground">, из них за исправления {points(a.preview.selfCorrection)}</span>}
      </p>
    </div>
  );
}

function ResearchPanel({ evidenceId }: { evidenceId: string }) {
  const { data: ws } = useQuery(workspaceByEvidenceQuery(evidenceId));
  if (!ws) return <Skeleton className="h-40" />;
  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">{ws.task.question}</p>
      <p className="text-sm">Начальная позиция: «{ws.initialPosition}»</p>
      <ConclusionView ws={ws} />
    </div>
  );
}

function EvidenceSheet({ id, teamName, onClose, onDecided }: { id: string | null; teamName: string; onClose: () => void; onDecided: () => Promise<void> }) {
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
              {e.module === 'sprint' ? `${EVIDENCE_KIND[e.kind]}, ${formatDateTime(e.createdAt)}` : formatDateTime(e.createdAt)}
            </SheetDescription>
          )}
        </SheetHeader>
        {!e ? (
          <Skeleton className="mx-4 h-40" />
        ) : (
          <div className="grid gap-6 px-4 pb-6">
            {e.subjectType === 'practice_attempt' ? (
              <PracticePanel attemptId={e.subjectId} />
            ) : e.subjectType === 'research_conclusion' ? (
              <ResearchPanel evidenceId={e.id} />
            ) : (
              e.note && <p className="text-sm whitespace-pre-line">{e.note}</p>
            )}
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
                <ReviewForm evidenceId={e.id} subjectName={teamName} onDone={onDecided} />
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
  const [leaving, setLeaving] = useState<string | null>(null);
  // The decided row folds away before the refetch removes it, so the reviewer sees where the queue moved.
  const decided = async () => {
    setLeaving(openId);
    setOpenId(null);
    if (!prefersReducedMotion()) await new Promise((r) => setTimeout(r, 300));
  };
  const list = useQuery(evidenceListQuery({ status }));
  const teams = useQuery(teamsQuery);
  const names = new Map((teams.data ?? []).map((t) => [t.id, t.name]));
  const who = (e: QueueItem) => (e.teamId ? names.get(e.teamId) : null) ?? e.submitterName;
  const opened = list.data?.find((e) => e.id === openId);

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Проверка</h1>
          <p className="text-muted-foreground mt-1">Баллы начисляются только после вашего решения.</p>
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
            <li
              key={e.id}
              className={cn('grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none', e.id === leaving ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]')}
            >
              <div className="min-h-0 overflow-hidden">
<button type="button" onClick={() => setOpenId(e.id)} className="hover:bg-muted/50 grid w-full gap-1 px-4 py-3 text-left transition-colors">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <span className="font-medium">{who(e)}</span>
                  <span className="text-muted-foreground">{EVIDENCE_SUBJECT[e.subjectType] ?? 'Подтверждение'}</span>
                  {e.module === 'sprint' && <span className="text-muted-foreground">{EVIDENCE_KIND[e.kind].toLowerCase()}</span>}
                  <span className="text-muted-foreground ml-auto text-xs">{formatRelative(e.createdAt)}</span>
                </div>
                {e.note && <p className="text-muted-foreground line-clamp-1 text-sm">{e.note}</p>}
              </button>
</div>
            </li>
          ))}
        </ul>
      )}
      <EvidenceSheet id={openId} teamName={opened ? who(opened) : ''} onClose={() => setOpenId(null)} onDecided={decided} />
    </div>
  );
}
