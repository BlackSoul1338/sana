import { FeedbackPopover } from '@/features/leave-feedback';
import type { Project } from '@/entities/project';
import { EvidenceStatus } from '@/entities/evidence';
import { EVIDENCE_KIND } from '@/shared/config';
import { formatRelative } from '@/shared/lib/format';
import { EmptyState } from '@/shared/ui/status';

export function EvidenceList({ project, members, canFeedback }: { project: Project; members: Record<string, string>; canFeedback?: boolean }) {
  if (project.evidence.length === 0) {
    return <EmptyState title="Подтверждений пока нет" text="Ссылки, скриншоты и записи интервью попадут сюда и уйдут ментору." />;
  }
  return (
    <ul className="divide-y">
      {[...project.evidence].reverse().map((e) => (
        <li key={e.id} className="grid gap-1 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{EVIDENCE_KIND[e.kind]}</span>
            <span className="text-muted-foreground text-xs">
              {members[e.submittedBy] ?? 'участник'} · {formatRelative(e.createdAt)}
            </span>
            <EvidenceStatus status={e.status} />
            {canFeedback && (e.status === 'approved' || e.status === 'adjusted') && (
              <span className="ml-auto">
                <FeedbackPopover evidenceId={e.id} />
              </span>
            )}
          </div>
          {e.note && <p className="text-muted-foreground line-clamp-2 text-sm">{e.note}</p>}
          {e.url && (
            <a href={e.url} target="_blank" rel="noreferrer" className="text-primary truncate text-sm underline-offset-4 hover:underline">
              {e.url}
            </a>
          )}
          {e.reviewComment && (
            <p className="border-primary/40 border-l-2 pl-3 text-sm">
              <span className="text-muted-foreground">Ментор: </span>
              {e.reviewComment}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
