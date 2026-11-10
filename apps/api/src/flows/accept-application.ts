import type { z } from 'zod';
import type { match } from '@sana/contracts';
import { inTx, type Ctx } from '../platform/context.js';
import { createAssignment, findTask } from '../core/catalog/service.js';
import { decide } from '../modules/match/service.js';
import { linkAssignment } from '../modules/sprint/service.js';

/**
 * Сквозной сценарий кейсов 3 → 1: бизнес принимает заявку → задача закрепляется за командой →
 * этапы попадают в трекер Startup Sprint (привязка к активному проекту команды или новый проект).
 * Всё в одной транзакции: либо команда получила задачу и проект, либо ничего не изменилось.
 */
export async function decideApplication(ctx: Ctx, applicationId: string, input: z.infer<typeof match.DecisionInput>): Promise<match.DecisionResult> {
  return inTx(ctx, async (t) => {
    const { app, dto } = await decide(t, applicationId, input);
    if (app.status !== 'accepted') return { application: dto, assignmentId: null, projectId: null, projectCreated: false };
    const assignment = await createAssignment(t, { taskId: app.taskId, teamId: app.teamId, source: 'match' });
    const task = await findTask(t.db, app.taskId);
    const link = await linkAssignment(t, { teamId: app.teamId, assignmentId: assignment.id, taskTitle: task!.title, taskSummary: task!.summary });
    return { application: dto, assignmentId: assignment.id, projectId: link.projectId, projectCreated: link.created };
  });
}
