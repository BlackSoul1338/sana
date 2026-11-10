import { and, asc, desc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { bcb, TaskCard, TaskRequirements } from '@sana/contracts';
import { inTx, requireRole, type ActorProfile, type Ctx } from '../../platform/context.js';
import { iso } from '../../platform/db/columns.js';
import { AppError, conflict, invalid, notFound, rule } from '../../platform/errors.js';
import { listSkills } from '../../core/identity/service.js';
import { publishTask, validateRequirements } from '../../core/catalog/service.js';
import { award } from '../../core/points/ledger.js';
import { analyzeDraft, cardText, composeCard, suggestRequirements, type DialogMessage } from './ai/functions.js';
import { buildDiff, fieldChanges } from './diff.js';
import { verifyAnalysis } from './quotes.js';
import { questionsMessage, selectQuestions } from './questions.js';
import { FIELD_ORDER, MAX_TURNS, READY_THRESHOLD, scoreFields } from './readiness.js';
import { scanAll } from './sensitive.js';
import { bcbAnalyses, bcbDrafts, bcbMessages } from './schema.js';
import type { FieldState } from './types.js';

const MODULE = 'challenge_builder';

type DraftRow = typeof bcbDrafts.$inferSelect;
type AnalysisRow = typeof bcbAnalyses.$inferSelect;

function requireBusiness(ctx: Ctx): ActorProfile & { orgId: string } {
  const p = requireRole(ctx, 'business');
  if (!p.orgId) throw rule('Профиль бизнеса не привязан к организации');
  return p as ActorProfile & { orgId: string };
}

/** Черновик виден только своей организации; чужой — как несуществующий. */
async function loadOwnDraft(ctx: Ctx, id: string, lock = false): Promise<DraftRow> {
  const p = requireBusiness(ctx);
  const q = ctx.db.select().from(bcbDrafts).where(and(eq(bcbDrafts.id, id), eq(bcbDrafts.orgId, p.orgId))).limit(1);
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw notFound('Черновик');
  return row;
}

async function loadMessages(ctx: Ctx, draftId: string) {
  return ctx.db.select().from(bcbMessages).where(eq(bcbMessages.draftId, draftId)).orderBy(asc(bcbMessages.seq));
}

async function lastAnalysis(ctx: Ctx, draftId: string): Promise<AnalysisRow | undefined> {
  const [row] = await ctx.db.select().from(bcbAnalyses).where(eq(bcbAnalyses.draftId, draftId)).orderBy(desc(bcbAnalyses.turn)).limit(1);
  return row;
}

const toTurnResult = (draftId: string, a: AnalysisRow): bcb.TurnResult => ({
  draftId,
  turn: a.turn,
  readiness: a.readiness,
  readyToCompose: a.readiness >= READY_THRESHOLD,
  fields: a.fields,
  questions: a.questions,
  changes: a.changes,
  turnsLeft: Math.max(0, MAX_TURNS - a.turn),
});

// ---------- диалог ----------

export async function createDraft(ctx: Ctx, input: z.infer<typeof bcb.CreateDraftInput>): Promise<bcb.TurnResult> {
  const p = requireBusiness(ctx);
  const [draft] = await ctx.db.insert(bcbDrafts).values({ orgId: p.orgId, authorId: p.id, rawText: input.text }).returning();
  try {
    return await runTurn(ctx, draft!.id, input.text);
  } catch (err) {
    // Первый ход не удался (модель недоступна) — пустой черновик не оставляем.
    await ctx.db.delete(bcbDrafts).where(eq(bcbDrafts.id, draft!.id));
    throw err;
  }
}

export async function addTurn(ctx: Ctx, draftId: string, input: z.infer<typeof bcb.TurnInput>): Promise<bcb.TurnResult> {
  return runTurn(ctx, draftId, input.text);
}

/**
 * Ход диалога. Модель вызывается вне транзакции (долгий вызов не держит блокировки),
 * затем одной транзакцией пишутся реплика бизнеса, вопросы ассистента и снимок полей.
 * Если параллельно прошёл другой ход, этот отклоняется с 409.
 */
async function runTurn(ctx: Ctx, draftId: string, userText: string): Promise<bcb.TurnResult> {
  const draft = await loadOwnDraft(ctx, draftId);
  if (draft.status === 'published') throw conflict('Задача уже опубликована');
  if (draft.turnCount >= MAX_TURNS) throw new AppError('turn_limit', 409, `Достигнут лимит ${MAX_TURNS} ходов — соберите карточку`);

  const history = await loadMessages(ctx, draftId);
  const dialog: DialogMessage[] = [...history.map((m) => ({ role: m.role, text: m.text })), { role: 'user', text: userText }];
  const businessTexts = dialog.filter((m) => m.role === 'user').map((m) => m.text);

  const ai = await analyzeDraft(ctx.ai, dialog);
  const verified = verifyAnalysis(ai, businessTexts);
  const { readiness, fields } = scoreFields(verified);
  const turn = draft.turnCount + 1;
  const questions = selectQuestions({ fields, aiQuestions: ai.questions, turn });
  const prev = await lastAnalysis(ctx, draftId);
  const changes = fieldChanges(prev?.fields ?? null, fields);

  const saved = await inTx(ctx, async (t) => {
    const [locked] = await t.db.select().from(bcbDrafts).where(eq(bcbDrafts.id, draftId)).for('update').limit(1);
    if (!locked || locked.turnCount !== draft.turnCount) throw conflict('Параллельный ход: обновите черновик и повторите');
    const seq = history.length;
    const [userMsg] = await t.db.insert(bcbMessages).values({ draftId, seq, role: 'user', text: userText, createdAt: t.now }).returning();
    await t.db.insert(bcbMessages).values({ draftId, seq: seq + 1, role: 'assistant', text: questionsMessage(questions), createdAt: t.now });
    const [analysis] = await t.db
      .insert(bcbAnalyses)
      .values({ draftId, messageId: userMsg!.id, turn, fields, readiness, questions, changes, createdAt: t.now })
      .returning();
    await t.db
      .update(bcbDrafts)
      .set({ turnCount: turn, readiness, status: 'collecting', card: null, summary: null, requirements: null, warnings: [], updatedAt: t.now })
      .where(eq(bcbDrafts.id, draftId));
    return analysis!;
  });
  return toTurnResult(draftId, saved);
}

// ---------- чтение ----------

export async function listDrafts(ctx: Ctx): Promise<bcb.DraftSummary[]> {
  const p = requireBusiness(ctx);
  const rows = await ctx.db.select().from(bcbDrafts).where(eq(bcbDrafts.orgId, p.orgId)).orderBy(desc(bcbDrafts.createdAt));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    readiness: r.readiness,
    preview: r.rawText.length > 140 ? `${r.rawText.slice(0, 137)}…` : r.rawText,
    createdAt: iso(r.createdAt),
  }));
}

export async function getDraft(ctx: Ctx, id: string): Promise<bcb.Draft> {
  const draft = await loadOwnDraft(ctx, id);
  const [messages, last] = await Promise.all([loadMessages(ctx, id), lastAnalysis(ctx, id)]);
  return {
    id: draft.id,
    orgId: draft.orgId,
    status: draft.status,
    turnCount: draft.turnCount,
    readiness: draft.readiness,
    messages: messages.map((m) => ({ role: m.role, text: m.text, at: iso(m.createdAt) })),
    latest: last ? toTurnResult(id, last) : null,
    card: draft.card,
    summary: draft.summary,
    requirements: draft.requirements,
    taskId: draft.taskId,
    createdAt: iso(draft.createdAt),
  };
}

export async function getDiff(ctx: Ctx, id: string): Promise<bcb.DraftDiff> {
  await loadOwnDraft(ctx, id);
  const [analyses, messages] = await Promise.all([
    ctx.db.select().from(bcbAnalyses).where(eq(bcbAnalyses.draftId, id)).orderBy(asc(bcbAnalyses.turn)),
    loadMessages(ctx, id),
  ]);
  const textById = new Map(messages.map((m) => [m.id, m.text]));
  const diff = buildDiff(analyses.map((a) => ({ turn: a.turn, readiness: a.readiness, fields: a.fields, changes: a.changes, answer: textById.get(a.messageId) ?? '' })));
  if (!diff) throw notFound('История черновика');
  return diff;
}

// ---------- карточка и публикация ----------

function sensitiveGuard(items: { text: string; where: string }[]) {
  const findings = scanAll(items);
  if (findings.length) {
    throw new AppError('sensitive_data', 422, 'В тексте найдены персональные данные — удалите их перед публикацией', undefined, { findings });
  }
}

/** Поле без подтверждённых сведений в карточке всегда «не указано», что бы ни вернула модель. */
export function enforceMissing(card: TaskCard, fields: FieldState[]): TaskCard {
  const out = { ...card };
  for (const f of fields) {
    if (f.status === 'missing') out[f.key] = { text: 'не указано', source: 'not_specified' };
  }
  return out;
}

export async function compose(ctx: Ctx, id: string): Promise<bcb.ComposeResult> {
  const draft = await loadOwnDraft(ctx, id);
  if (draft.status === 'published') throw conflict('Задача уже опубликована');
  const last = await lastAnalysis(ctx, id);
  if (!last) throw rule('Сначала опишите проблему');
  const messages = await loadMessages(ctx, id);
  sensitiveGuard(messages.filter((m) => m.role === 'user').map((m) => ({ text: m.text, where: `реплика ${m.seq / 2 + 1}` })));

  const dialog = messages.map((m) => ({ role: m.role, text: m.text }));
  const aiCard = await composeCard(ctx.ai, dialog, last.fields);
  const card = enforceMissing(
    Object.fromEntries(FIELD_ORDER.map((k) => [k, { text: aiCard[k].text.trim() || 'не указано', source: aiCard[k].source }])) as TaskCard,
    last.fields,
  );
  const skills = await listSkills(ctx);
  const requirements = await suggestRequirements(ctx.ai, card, skills).catch(() => null);
  const suggestion: TaskRequirements = requirements ?? { topic: 'общее', difficulty: 2, estHours: 40, skills: [] };
  const warnings = [
    ...aiCard.commercialSecretWarnings.map((w) => `Возможная коммерческая тайна: ${w}`),
    ...(last.readiness < READY_THRESHOLD ? [`Готовность ${last.readiness} из 100 — ниже порога ${READY_THRESHOLD}, задача будет ниже в каталоге`] : []),
    ...(requirements ? [] : ['Не удалось предложить требования — заполните навыки вручную']),
    ...card.title.source === 'not_specified' ? ['Не указано название задачи'] : [],
  ];
  const summary = aiCard.summary.trim() || card.goal.text;

  await ctx.db
    .update(bcbDrafts)
    .set({ status: 'composed', card, summary, requirements: suggestion, warnings, updatedAt: ctx.now })
    .where(eq(bcbDrafts.id, id));
  return { card, summary, requirementsSuggestion: suggestion, warnings };
}

export async function updateCard(ctx: Ctx, id: string, input: z.infer<typeof bcb.UpdateCardInput>): Promise<bcb.Draft> {
  const draft = await loadOwnDraft(ctx, id);
  if (draft.status !== 'composed') throw conflict('Править можно собранную, но ещё не опубликованную карточку');
  if (input.requirements) await validateRequirements(ctx.db, input.requirements);
  if (input.card) sensitiveGuard(FIELD_ORDER.map((k) => ({ text: input.card![k].text, where: `поле ${k}` })));
  if (input.summary) sensitiveGuard([{ text: input.summary, where: 'summary' }]);
  await ctx.db
    .update(bcbDrafts)
    .set({
      ...(input.card ? { card: input.card } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      ...(input.requirements ? { requirements: input.requirements } : {}),
      updatedAt: ctx.now,
    })
    .where(eq(bcbDrafts.id, id));
  return getDraft(ctx, id);
}

/** Публикация только после явного подтверждения представителем бизнеса. Баллы готовности — организации. */
export async function publish(ctx: Ctx, id: string): Promise<z.infer<typeof bcb.PublishResult>> {
  const p = requireBusiness(ctx);
  return inTx(ctx, async (t) => {
    const draft = await loadOwnDraft(t, id, true);
    if (draft.status === 'published') throw conflict('Задача уже опубликована');
    if (draft.status !== 'composed' || !draft.card) throw conflict('Сначала соберите карточку');
    if (!draft.requirements || !draft.requirements.skills.length) {
      throw invalid('Укажите требования к команде: тема, сложность, часы и навыки', [{ path: 'requirements', message: 'Не заполнены' }]);
    }
    sensitiveGuard([...FIELD_ORDER.map((k) => ({ text: draft.card![k].text, where: `поле ${k}` })), { text: draft.summary ?? '', where: 'summary' }]);

    const title = draft.card.title.source === 'dialog' ? draft.card.title.text : draft.rawText.slice(0, 80);
    const task = await publishTask(t, {
      ownerOrgId: p.orgId,
      title,
      summary: draft.summary ?? '',
      readiness: draft.readiness,
      requirements: draft.requirements,
      card: draft.card,
      sourceRef: `bcb:${draft.id}`,
      createdBy: p.id,
    });
    const [ev] = await award(t.db, [
      {
        subjectType: 'org',
        subjectId: p.orgId,
        module: MODULE,
        ruleId: 'challenge_readiness',
        points: draft.readiness,
        explanation: `Задача «${title}» опубликована с готовностью ${draft.readiness}/100: конкретность, данные и измеримые критерии`,
        actorId: p.id,
        idempotencyKey: `bcb:publish:${draft.id}`,
      },
    ]);
    await t.db.update(bcbDrafts).set({ status: 'published', taskId: task.id, updatedAt: t.now }).where(eq(bcbDrafts.id, id));
    return { taskId: task.id, readiness: draft.readiness, points: ev?.points ?? 0 };
  });
}

export { cardText };
