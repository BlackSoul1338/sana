import type { practice } from '@sana/contracts';
import { quoteFound } from '../../platform/ai/quotes.js';
import type { Award } from '../../core/points/ledger.js';
import { PRACTICE_POINTS } from './points.config.js';
import { MODULE } from './types.js';

type Criterion = practice.Criterion;
type Check = practice.Check;
type Verdict = practice.Verdict;

export type QuizQuestion = { id: string; correct: number; explanation: string };

export function scoreQuiz(questions: QuizQuestion[], answers: { questionId: string; option: number }[]) {
  const given = new Map(answers.map((a) => [a.questionId, a.option]));
  const perQuestion = questions.map((q) => {
    const option = given.get(q.id) ?? null;
    return { questionId: q.id, option, correct: q.correct, ok: option === q.correct, explanation: q.explanation };
  });
  return { correct: perQuestion.filter((q) => q.ok).length, total: questions.length, perQuestion };
}

/** Raw model output; criterion ids are already limited to the assignment's ids by the runtime schema. */
export type RawCheck = {
  criteria: { criterionId: string; verdict: Verdict; explanation: string; errors: { quote: string; issue: string }[]; recommendation: string }[];
};

/**
 * Trust boundary for the model: one entry per assignment criterion in the assignment's order,
 * a skipped criterion becomes "not checked", and an error whose quote is not in the answer is dropped.
 */
export function verifyCheck(raw: RawCheck, criteria: Criterion[], answer: string): Check {
  let droppedQuotes = 0;
  const byId = new Map<string, RawCheck['criteria'][number]>();
  for (const c of raw.criteria) if (!byId.has(c.criterionId)) byId.set(c.criterionId, c);
  const out = criteria.map((cr) => {
    const c = byId.get(cr.id);
    if (!c) return { criterionId: cr.id, verdict: null, explanation: '', errors: [], recommendation: '' };
    const errors = c.errors.filter((e) => {
      const ok = quoteFound(e.quote, answer);
      if (!ok) droppedQuotes++;
      return ok;
    });
    return { criterionId: cr.id, verdict: c.verdict, explanation: c.explanation.trim(), errors, recommendation: c.recommendation.trim() };
  });
  return { criteria: out, droppedQuotes };
}

const share = (v: Verdict | null) => (v ? PRACTICE_POINTS.verdictShare[v] : 0);

export function scoreCheck(criteria: Criterion[], check: Check | null) {
  if (!check || !criteria.length) return { correctness: 0, completeness: 0 };
  const verdicts = new Map(check.criteria.map((c) => [c.criterionId, c.verdict]));
  const correctness = criteria.reduce((s, cr) => s + cr.maxPoints * share(verdicts.get(cr.id) ?? null), 0);
  const covered = criteria.reduce((s, cr) => s + share(verdicts.get(cr.id) ?? null), 0) / criteria.length;
  return { correctness: Math.round(correctness), completeness: Math.round(covered * PRACTICE_POINTS.completeness) };
}

/** Criteria the student fixed on their own: weak or with a verified error before, met in the final attempt. */
export function selfCorrections(previous: (Check | null)[], final: Check | null): string[] {
  if (!final) return [];
  const weakBefore = new Set<string>();
  for (const p of previous) {
    for (const c of p?.criteria ?? []) {
      if (c.verdict === 'missed' || c.verdict === 'partial' || (c.verdict && c.errors.length > 0)) weakBefore.add(c.criterionId);
    }
  }
  return final.criteria.filter((c) => c.verdict === 'met' && c.errors.length === 0 && weakBefore.has(c.criterionId)).map((c) => c.criterionId);
}

export function preview(criteria: Criterion[], final: Check | null, previous: (Check | null)[]) {
  const { correctness, completeness } = scoreCheck(criteria, final);
  const fixed = selfCorrections(previous, final);
  const { each, cap } = PRACTICE_POINTS.selfCorrection;
  return { correctness, completeness, selfCorrection: Math.min(fixed.length * each, cap), completion: PRACTICE_POINTS.completion, corrected: fixed };
}

export type ApprovalFacts = {
  evidenceId: string;
  profileId: string;
  assignment: { id: string; title: string; criteria: Criterion[] };
  final: Check | null;
  previous: (Check | null)[];
};

/**
 * Points after the teacher's approval, to the student's profile. Keys are per assignment and student,
 * so reject → resend → approve still awards once. Without a model check only completion is awarded;
 * the teacher adds the rest with an adjustment.
 */
export function awardsForApproval(f: ApprovalFacts): Omit<Award, 'actorId'>[] {
  const p = preview(f.assignment.criteria, f.final, f.previous);
  const base = { subjectType: 'profile' as const, subjectId: f.profileId, module: MODULE, evidenceId: f.evidenceId };
  const key = (rule: string) => `practice:${rule}:${f.assignment.id}:${f.profileId}`;
  const title = `«${f.assignment.title}»`;
  return [
    { ...base, ruleId: 'practice_correctness', points: p.correctness, explanation: `Правильность по критериям задания ${title}`, idempotencyKey: key('correctness') },
    { ...base, ruleId: 'practice_completeness', points: p.completeness, explanation: `Полнота решения ${title}`, idempotencyKey: key('completeness') },
    {
      ...base,
      ruleId: 'practice_self_correction',
      points: p.selfCorrection,
      explanation: `Самостоятельно исправлено критериев: ${p.corrected.length}`,
      idempotencyKey: key('self_correction'),
    },
    { ...base, ruleId: 'practice_completion', points: p.completion, explanation: `Задание ${title} принято преподавателем`, idempotencyKey: key('completion') },
  ];
}
