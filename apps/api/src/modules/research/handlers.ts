import { eq } from 'drizzle-orm';
import type { Ctx } from '../../platform/context.js';
import type { DomainEvents, EventBus } from '../../platform/events.js';
import { award } from '../../core/points/ledger.js';
import { awardsForApproval } from './rules.js';
import { raConclusions, raItems, raTasks, raWorkspaces } from './schema.js';
import { MODULE, SUBJECT } from './types.js';

/** Teacher's decision on a conclusion: reject reopens the workspace, approval awards the team and cited authors. */
export async function onEvidenceReviewed(ctx: Ctx, e: DomainEvents['evidence.reviewed']) {
  const ev = e.evidence;
  if (ev.module !== MODULE || ev.subjectType !== SUBJECT.conclusion) return;
  const [c] = await ctx.db.select().from(raConclusions).where(eq(raConclusions.id, ev.subjectId)).limit(1);
  if (!c) return;
  const approved = e.decision !== 'reject';
  const [ws] = await ctx.db.update(raWorkspaces).set({ status: approved ? 'approved' : 'active' }).where(eq(raWorkspaces.id, c.workspaceId)).returning();
  if (!ws || !approved) return;
  const [[task], items] = await Promise.all([
    ctx.db.select().from(raTasks).where(eq(raTasks.id, ws.taskId)).limit(1),
    ctx.db.select().from(raItems).where(eq(raItems.workspaceId, ws.id)),
  ]);
  const awards = awardsForApproval({ evidenceId: ev.id, workspaceId: ws.id, teamId: ws.teamId, task: task!, assessment: c.assessment ?? null, statements: c.statements, items });
  await award(ctx.db, awards.map((a) => ({ ...a, actorId: e.reviewerId })));
}

export function registerResearchHandlers(bus: EventBus) {
  bus.on('evidence.reviewed', onEvidenceReviewed);
}
