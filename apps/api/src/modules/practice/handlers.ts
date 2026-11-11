import { and, asc, eq } from 'drizzle-orm';
import type { Ctx } from '../../platform/context.js';
import type { DomainEvents, EventBus } from '../../platform/events.js';
import { award } from '../../core/points/ledger.js';
import { awardsForApproval } from './rules.js';
import { plAssignments, plAttempts } from './schema.js';
import { MODULE, SUBJECT } from './types.js';

/** Teacher's decision on a sent attempt: reject opens a retry, approval awards the student's profile. */
export async function onEvidenceReviewed(ctx: Ctx, e: DomainEvents['evidence.reviewed']) {
  const ev = e.evidence;
  if (ev.module !== MODULE || ev.subjectType !== SUBJECT.attempt) return;
  const approved = e.decision !== 'reject';
  const [row] = await ctx.db
    .update(plAttempts)
    .set({ status: approved ? 'approved' : 'rejected' })
    .where(eq(plAttempts.id, ev.subjectId))
    .returning();
  if (!row || !approved) return;
  const [a] = await ctx.db.select().from(plAssignments).where(eq(plAssignments.id, row.assignmentId)).limit(1);
  if (!a) return;
  const all = await ctx.db
    .select()
    .from(plAttempts)
    .where(and(eq(plAttempts.assignmentId, a.id), eq(plAttempts.profileId, row.profileId)))
    .orderBy(asc(plAttempts.attemptNo));
  const previous = all.filter((x) => x.attemptNo < row.attemptNo).map((x) => x.aiCheck ?? null);
  const awards = awardsForApproval({ evidenceId: ev.id, profileId: row.profileId, assignment: a, final: row.aiCheck ?? null, previous });
  await award(ctx.db, awards.map((x) => ({ ...x, actorId: e.reviewerId })));
}

export function registerPracticeHandlers(bus: EventBus) {
  bus.on('evidence.reviewed', onEvidenceReviewed);
}
