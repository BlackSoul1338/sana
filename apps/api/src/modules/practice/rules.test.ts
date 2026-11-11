import { describe, expect, it } from 'vitest';
import type { practice } from '@sana/contracts';
import { awardsForApproval, preview, scoreQuiz, selfCorrections, verifyCheck, type RawCheck } from './rules.js';
import { gapTopics, recommendNext } from './recommend.js';

const criteria: practice.Criterion[] = [
  { id: 'k1', title: 'Пропуски', description: '', topic: 'очистка', maxPoints: 10 },
  { id: 'k2', title: 'Выбросы', description: '', topic: 'статистика', maxPoints: 20 },
];
const check = (k1: practice.Verdict | null, k2: practice.Verdict | null, errors: string[] = []): practice.Check => ({
  criteria: [
    { criterionId: 'k1', verdict: k1, explanation: '', errors: [], recommendation: '' },
    { criterionId: 'k2', verdict: k2, explanation: '', errors: errors.map((q) => ({ quote: q, issue: 'x' })), recommendation: '' },
  ],
  droppedQuotes: 0,
});

describe('practice: quiz', () => {
  it('counts only matching options; unanswered is wrong', () => {
    const r = scoreQuiz(
      [
        { id: 'a', correct: 1, explanation: '' },
        { id: 'b', correct: 0, explanation: '' },
      ],
      [{ questionId: 'a', option: 1 }],
    );
    expect(r).toMatchObject({ correct: 1, total: 2 });
    expect(r.perQuestion[1]).toMatchObject({ option: null, ok: false });
  });
});

describe('practice: verifyCheck', () => {
  const answer = 'Я заполнил пропуски медианой и удалил выбросы по IQR.';
  it('drops unverified quotes, keeps the first entry per criterion and marks skipped ones as not checked', () => {
    const raw: RawCheck = {
      criteria: [
        { criterionId: 'k2', verdict: 'partial', explanation: 'ок', recommendation: '', errors: [{ quote: 'удалил выбросы по IQR', issue: 'нет обоснования' }, { quote: 'нормализовал признаки', issue: 'выдумано' }] },
        { criterionId: 'k2', verdict: 'met', explanation: 'дубль', recommendation: '', errors: [] },
      ],
    };
    const v = verifyCheck(raw, criteria, answer);
    expect(v.criteria.map((c) => c.criterionId)).toEqual(['k1', 'k2']);
    expect(v.criteria[0]).toMatchObject({ verdict: null });
    expect(v.criteria[1]).toMatchObject({ verdict: 'partial', errors: [{ quote: 'удалил выбросы по IQR' }] });
    expect(v.droppedQuotes).toBe(1);
  });
});

describe('practice: points', () => {
  it('correctness by criterion weight, completeness by coverage', () => {
    expect(preview(criteria, check('met', 'partial'), [])).toMatchObject({ correctness: 20, completeness: 15, selfCorrection: 0, completion: 10 });
    expect(preview(criteria, null, [])).toMatchObject({ correctness: 0, completeness: 0, completion: 10 });
  });

  it('self-correction counts criteria weak before and met now; met from the start does not count', () => {
    expect(selfCorrections([check('met', 'missed')], check('met', 'met'))).toEqual(['k2']);
    expect(selfCorrections([check('met', 'met', ['x'])], check('met', 'met'))).toEqual(['k2']);
    expect(selfCorrections([null], check('met', 'met'))).toEqual([]);
    expect(selfCorrections([check('missed', 'missed')], null)).toEqual([]);
  });

  it('awards go to the profile with keys per assignment and student', () => {
    const awards = awardsForApproval({ evidenceId: 'e', profileId: 'p', assignment: { id: 'a', title: 'T', criteria }, final: check('met', 'met'), previous: [check('met', 'missed')] });
    expect(awards.map((a) => [a.ruleId, a.points, a.idempotencyKey])).toEqual([
      ['practice_correctness', 30, 'practice:correctness:a:p'],
      ['practice_completeness', 20, 'practice:completeness:a:p'],
      ['practice_self_correction', 5, 'practice:self_correction:a:p'],
      ['practice_completion', 10, 'practice:completion:a:p'],
    ]);
    expect(awards.every((a) => a.subjectType === 'profile' && a.subjectId === 'p')).toBe(true);
  });
});

describe('practice: next assignment', () => {
  const cands = [
    { id: 'easy', title: 'Б', difficulty: 1, topics: ['очистка'] },
    { id: 'stat', title: 'А', difficulty: 2, topics: ['статистика'] },
  ];
  it('picks the heaviest gap', () => {
    const gaps = gapTopics(['очистка'], [{ topic: 'статистика', verdict: 'missed' }]);
    expect(recommendNext(gaps, cands)).toMatchObject({ assignmentId: 'stat', topic: 'статистика' });
  });
  it('without gaps falls back to the easiest; nothing left — null', () => {
    expect(recommendNext(new Map(), cands)).toMatchObject({ assignmentId: 'easy', topic: null });
    expect(recommendNext(new Map(), [])).toBeNull();
  });
});
