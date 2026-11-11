import type { research } from '@sana/contracts';
import type { Award } from '../../core/points/ledger.js';
import type { FieldError } from '../../platform/errors.js';
import { quoteFound } from '../../platform/ai/quotes.js';
import { RESEARCH_POINTS } from './points.config.js';
import { MODULE } from './types.js';

type ItemLite = { id: string; kind: research.Item['kind']; threadId: string | null; stance: research.Item['stance']; linkIds: string[]; createdBy: string };
type Statement = { text: string; itemIds: string[] };

/** Every statement of the conclusion must rest on at least one argument or source of this workspace. */
export function checkStatements(statements: Statement[], items: Map<string, { kind: research.Item['kind'] }>): FieldError[] {
  return statements.flatMap((s, i) => {
    const supported = s.itemIds.some((id) => {
      const k = items.get(id)?.kind;
      return k === 'argument' || k === 'source';
    });
    const unknown = s.itemIds.filter((id) => !items.has(id));
    if (unknown.length) return [{ path: `statements.${i}.itemIds`, message: 'Ссылка на элемент не из этого исследования' }];
    return supported ? [] : [{ path: `statements.${i}.itemIds`, message: 'Утверждению нужен аргумент или источник' }];
  });
}

export const citedIds = (statements: Statement[]) => new Set(statements.flatMap((s) => s.itemIds));

/** Contribution by observable actions only: items added and items cited in the conclusion. Messages are not an input. */
export function contributions(memberIds: string[], roles: Map<string, research.Contribution['role']>, items: ItemLite[], cited: Set<string>) {
  return memberIds.map((profileId) => {
    const mine = items.filter((i) => i.createdBy === profileId);
    return {
      profileId,
      role: roles.get(profileId) ?? null,
      sourcesAdded: mine.filter((i) => i.kind === 'source').length,
      argumentsAdded: mine.filter((i) => i.kind === 'argument').length,
      questionsAdded: mine.filter((i) => i.kind === 'question').length,
      citedInConclusion: mine.filter((i) => cited.has(i.id)).length,
    };
  });
}

/** Argument map from the board: for/against per thread, arguments without a linked source, threads without counter-arguments. */
export function argumentMap(threadIds: string[], items: ItemLite[]): research.ArgumentMap {
  const kindOf = new Map(items.map((i) => [i.id, i.kind]));
  const threads = threadIds.map((threadId) => {
    const args = items.filter((i) => i.kind === 'argument' && i.threadId === threadId);
    return {
      threadId,
      for: args.filter((a) => a.stance !== 'against').map((a) => a.id),
      against: args.filter((a) => a.stance === 'against').map((a) => a.id),
      unsupported: args.filter((a) => !a.linkIds.some((l) => kindOf.get(l) === 'source')).map((a) => a.id),
    };
  });
  return { threads, noCounterArguments: threads.filter((t) => t.for.length > 0 && t.against.length === 0).map((t) => t.threadId) };
}

export function positionGrowth(statements: Statement[], items: ItemLite[]): research.Conclusion['growth'] {
  const cited = citedIds(statements);
  const citedItems = items.filter((i) => cited.has(i.id));
  return {
    citedSources: citedItems.filter((i) => i.kind === 'source').length,
    citedArguments: citedItems.filter((i) => i.kind === 'argument').length,
    counterArgumentsAddressed: citedItems.filter((i) => i.kind === 'argument' && i.stance === 'against').length,
    statements: statements.length,
  };
}

/** The model's growth explanation is kept only if both quotes are found in the team's own texts. */
export function verifyGrowth(
  growth: { initialQuote: string; finalQuote: string; explanation: string } | null,
  initialPosition: string,
  finalTexts: string,
): research.Assessment['growth'] {
  if (!growth) return null;
  return quoteFound(growth.initialQuote, initialPosition) && quoteFound(growth.finalQuote, finalTexts) ? growth : null;
}

export type ApprovalFacts = {
  evidenceId: string;
  workspaceId: string;
  teamId: string;
  task: { title: string; rubric: research.RubricItem[] };
  assessment: research.Assessment | null;
  statements: Statement[];
  items: ItemLite[];
};

/** Team points by rubric level and completion; personal points for cited items, capped. */
export function awardsForApproval(f: ApprovalFacts): Omit<Award, 'actorId'>[] {
  const level = new Map((f.assessment?.rubric ?? []).map((r) => [r.key, r.level]));
  const team = { subjectType: 'team' as const, subjectId: f.teamId, module: MODULE, evidenceId: f.evidenceId };
  const awards: Omit<Award, 'actorId'>[] = f.task.rubric.map((r) => {
    const l = level.get(r.key) ?? null;
    return {
      ...team,
      ruleId: `research_${r.key}`,
      points: Math.round(r.maxPoints * (l ? RESEARCH_POINTS.levelShare[l] : 0)),
      explanation: `${r.title}: ${l ? { strong: 'сильно', adequate: 'достаточно', weak: 'слабо' }[l] : 'не оценено'}`,
      idempotencyKey: `research:rubric:${f.workspaceId}:${r.key}`,
    };
  });
  awards.push({ ...team, ruleId: 'research_completion', points: RESEARCH_POINTS.completion, explanation: `Исследование «${f.task.title}» принято`, idempotencyKey: `research:completion:${f.workspaceId}` });
  const cited = citedIds(f.statements);
  const perAuthor = new Map<string, number>();
  for (const i of f.items) if (cited.has(i.id)) perAuthor.set(i.createdBy, (perAuthor.get(i.createdBy) ?? 0) + 1);
  for (const [profileId, n] of perAuthor) {
    awards.push({
      subjectType: 'profile',
      subjectId: profileId,
      module: MODULE,
      evidenceId: f.evidenceId,
      ruleId: 'research_cited',
      points: Math.min(n * RESEARCH_POINTS.cited.each, RESEARCH_POINTS.cited.cap),
      explanation: `В выводе использовано ваших элементов: ${n}`,
      idempotencyKey: `research:contribution:${f.workspaceId}:${profileId}`,
    });
  }
  return awards;
}
