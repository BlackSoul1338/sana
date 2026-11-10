import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { Evidence, EvidenceQueueQuery, ReviewInput, ReviewResult, UploadUrlInput } from '@sana/contracts';
import { inTx, requireProfile, requireRole, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso, isoOrNull } from '../../platform/db/columns.js';
import { conflict, forbidden, invalid, notFound } from '../../platform/errors.js';
import type { EvidenceSnapshot } from '../../platform/events.js';
import { teamIdsOf, isTeamMember } from '../identity/service.js';
import { award, eventsForEvidence, toPointEvent } from '../points/ledger.js';
import { evidence } from './schema.js';

type Row = typeof evidence.$inferSelect;

export const toEvidence = (r: Row): Evidence => ({
  id: r.id,
  module: r.module,
  subjectType: r.subjectType,
  subjectId: r.subjectId,
  teamId: r.teamId,
  submittedBy: r.submittedBy,
  kind: r.kind,
  url: r.url,
  storagePath: r.storagePath,
  note: r.note,
  status: r.status,
  reviewedBy: r.reviewedBy,
  reviewComment: r.reviewComment,
  reviewedAt: isoOrNull(r.reviewedAt),
  createdAt: iso(r.createdAt),
});

const snapshot = (r: Row): EvidenceSnapshot => ({
  id: r.id,
  module: r.module,
  subjectType: r.subjectType,
  subjectId: r.subjectId,
  teamId: r.teamId,
  submittedBy: r.submittedBy,
  kind: r.kind,
  url: r.url,
  status: r.status,
  createdAt: r.createdAt,
});

export const isApprovedStatus = (s: Row['status']) => s === 'approved' || s === 'adjusted';

/** Путь файла привязан к пользователю: чужой загруженный файл к подтверждению не приложить. */
const storagePrefix = (userId: string) => `${userId}/`;

export async function requestUploadUrl(ctx: Ctx, input: z.infer<typeof UploadUrlInput>) {
  const p = requireRole(ctx, 'student');
  const safe = input.fileName.replace(/[^\w.-]+/g, '_').slice(-80);
  const storagePath = `${storagePrefix(p.id)}${randomUUID()}-${safe}`;
  const { signedUrl, token } = await ctx.storage.createUploadUrl(storagePath);
  return { storagePath, signedUrl, token };
}

export type NewEvidence = {
  module: string;
  subjectType: string;
  subjectId: string;
  teamId: string | null;
  kind: Row['kind'];
  url?: string | undefined;
  storagePath?: string | undefined;
  note: string;
};

/** Создание подтверждения. Модуль заранее проверил, что субъект существует и принадлежит команде. */
export async function createEvidence(ctx: Ctx, input: NewEvidence): Promise<Row> {
  const p = requireRole(ctx, 'student');
  if (input.storagePath && !input.storagePath.startsWith(storagePrefix(p.id))) {
    throw invalid('Файл загружен другим пользователем', [{ path: 'storagePath', message: 'Чужой путь' }]);
  }
  const [row] = await ctx.db
    .insert(evidence)
    .values({
      module: input.module,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      teamId: input.teamId,
      submittedBy: p.id,
      kind: input.kind,
      url: input.url ?? null,
      storagePath: input.storagePath ?? null,
      note: input.note,
      createdAt: ctx.now,
    })
    .returning();
  return row!;
}

export async function findEvidence(db: DbLike, id: string): Promise<Row | undefined> {
  const [row] = await db.select().from(evidence).where(eq(evidence.id, id)).limit(1);
  return row;
}

export async function evidenceForSubjects(db: DbLike, subjectIds: string[]): Promise<Row[]> {
  if (!subjectIds.length) return [];
  return db.select().from(evidence).where(inArray(evidence.subjectId, subjectIds)).orderBy(desc(evidence.createdAt));
}

export async function evidenceForTeam(db: DbLike, teamId: string, module?: string): Promise<Row[]> {
  return db
    .select()
    .from(evidence)
    .where(and(eq(evidence.teamId, teamId), module ? eq(evidence.module, module) : undefined))
    .orderBy(desc(evidence.createdAt));
}

/** Очередь проверки: куратор видит всё, студент — подтверждения своих команд. */
export async function listEvidence(ctx: Ctx, q: z.infer<typeof EvidenceQueueQuery>): Promise<Evidence[]> {
  const p = requireRole(ctx, 'mentor', 'student');
  let teamFilter: string[] | undefined;
  if (p.role === 'student') {
    teamFilter = await teamIdsOf(ctx.db, p.id);
    if (q.teamId) teamFilter = teamFilter.filter((t) => t === q.teamId);
    if (!teamFilter.length) return [];
  }
  const rows = await ctx.db
    .select()
    .from(evidence)
    .where(
      and(
        eq(evidence.status, q.status),
        q.module ? eq(evidence.module, q.module) : undefined,
        teamFilter ? inArray(evidence.teamId, teamFilter) : q.teamId ? eq(evidence.teamId, q.teamId) : undefined,
      ),
    )
    .orderBy(q.status === 'pending' ? evidence.createdAt : desc(evidence.createdAt));
  return rows.map(toEvidence);
}

export async function getEvidence(ctx: Ctx, id: string) {
  const p = requireProfile(ctx);
  const row = await findEvidence(ctx.db, id);
  if (!row) throw notFound('Подтверждение');
  const allowed =
    p.role === 'mentor' || row.submittedBy === p.id || (p.role === 'student' && !!row.teamId && (await isTeamMember(ctx.db, row.teamId, p.id)));
  if (!allowed) throw forbidden();
  const downloadUrl = row.storagePath ? await ctx.storage.createDownloadUrl(row.storagePath) : null;
  return { ...toEvidence(row), downloadUrl };
}

/**
 * Решение куратора. В одной транзакции: статус → событие evidence.reviewed (модуль начисляет баллы по своим правилам)
 * → для adjust — отдельное событие-поправка с комментарием.
 */
export async function reviewEvidence(ctx: Ctx, id: string, input: z.infer<typeof ReviewInput>): Promise<z.infer<typeof ReviewResult>> {
  const mentor = requireRole(ctx, 'mentor');
  return inTx(ctx, async (t) => {
    const [locked] = await t.db.select().from(evidence).where(eq(evidence.id, id)).for('update').limit(1);
    if (!locked) throw notFound('Подтверждение');
    if (locked.submittedBy === mentor.id) throw forbidden('Нельзя проверять собственное подтверждение');
    if (locked.status !== 'pending') throw conflict(`Подтверждение уже рассмотрено (статус ${locked.status})`);

    const status = input.decision === 'approve' ? 'approved' : input.decision === 'reject' ? 'rejected' : 'adjusted';
    const [updated] = await t.db
      .update(evidence)
      .set({ status, reviewedBy: mentor.id, reviewComment: input.comment || null, reviewedAt: t.now })
      .where(eq(evidence.id, id))
      .returning();

    await t.bus.emit(t, 'evidence.reviewed', {
      evidence: snapshot(updated!),
      decision: input.decision,
      comment: input.comment,
      reviewerId: mentor.id,
    });

    if (input.decision === 'adjust' && input.adjustPoints) {
      await award(t.db, [
        {
          subjectType: updated!.teamId ? 'team' : 'profile',
          subjectId: updated!.teamId ?? updated!.submittedBy,
          module: updated!.module,
          ruleId: 'mentor_adjustment',
          points: input.adjustPoints,
          explanation: `Корректировка куратора: ${input.comment}`,
          evidenceId: id,
          actorId: mentor.id,
          idempotencyKey: `mentor_adjustment:evidence:${id}`,
        },
      ]);
    }

    const awarded = await eventsForEvidence(t.db, id);
    return { evidence: toEvidence(updated!), awarded: awarded.map(toPointEvent) };
  });
}
