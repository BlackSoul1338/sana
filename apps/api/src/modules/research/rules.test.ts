import { describe, expect, it } from 'vitest';
import { argumentMap, awardsForApproval, checkStatements, contributions, verifyGrowth } from './rules.js';

const item = (id: string, kind: 'argument' | 'source' | 'question', createdBy: string, extra: Partial<{ threadId: string; stance: 'for' | 'against'; linkIds: string[] }> = {}) => ({
  id,
  kind,
  createdBy,
  threadId: extra.threadId ?? null,
  stance: extra.stance ?? null,
  linkIds: extra.linkIds ?? [],
});
const items = [item('s1', 'source', 'ann'), item('a1', 'argument', 'bob', { threadId: 't1', stance: 'for', linkIds: ['s1'] }), item('a2', 'argument', 'bob', { threadId: 't1', stance: 'for' }), item('q1', 'question', 'ann')];

describe('research rules', () => {
  it('statements need an argument or source of this workspace', () => {
    const kinds = new Map(items.map((i) => [i.id, { kind: i.kind }]));
    expect(checkStatements([{ text: 'x', itemIds: ['a1'] }], kinds)).toEqual([]);
    expect(checkStatements([{ text: 'x', itemIds: ['q1'] }], kinds)[0]!.path).toBe('statements.0.itemIds');
    expect(checkStatements([{ text: 'x', itemIds: ['zzz'] }], kinds)).toHaveLength(1);
  });

  it('contribution counts actions and citations, never messages', () => {
    const c = contributions(['ann', 'bob', 'cat'], new Map([['ann', 'critic' as const]]), items, new Set(['s1', 'a1']));
    expect(c).toEqual([
      { profileId: 'ann', role: 'critic', sourcesAdded: 1, argumentsAdded: 0, questionsAdded: 1, citedInConclusion: 1 },
      { profileId: 'bob', role: null, sourcesAdded: 0, argumentsAdded: 2, questionsAdded: 0, citedInConclusion: 1 },
      { profileId: 'cat', role: null, sourcesAdded: 0, argumentsAdded: 0, questionsAdded: 0, citedInConclusion: 0 },
    ]);
  });

  it('argument map flags unsupported arguments and threads without counter-arguments', () => {
    expect(argumentMap(['t1'], items)).toEqual({ threads: [{ threadId: 't1', for: ['a1', 'a2'], against: [], unsupported: ['a2'] }], noCounterArguments: ['t1'] });
  });

  it('growth explanation survives only with both quotes verified', () => {
    const g = { initialQuote: 'очереди из-за кассы', finalQuote: 'узкое место — бариста', explanation: 'e' };
    expect(verifyGrowth(g, 'Мы думали, очереди из-за кассы.', 'Узкое место — бариста на пике.')).toEqual(g);
    expect(verifyGrowth({ ...g, finalQuote: 'придумано' }, 'Мы думали, очереди из-за кассы.', 'Узкое место — бариста.')).toBeNull();
  });

  it('rubric points to the team, personal points to cited authors with a cap', () => {
    const many = Array.from({ length: 7 }, (_, i) => item(`x${i}`, 'source', 'ann'));
    const awards = awardsForApproval({
      evidenceId: 'e',
      workspaceId: 'w',
      teamId: 'team',
      task: { title: 'T', rubric: [{ key: 'argumentation', title: 'A', description: '', maxPoints: 20 }, { key: 'originality', title: 'O', description: '', maxPoints: 10 }] },
      assessment: { rubric: [{ key: 'argumentation', level: 'adequate', explanation: '', itemIds: [] }], growth: null, recommendations: [] },
      statements: [{ text: 's', itemIds: many.map((m) => m.id) }],
      items: many,
    });
    expect(awards.map((a) => [a.subjectType, a.ruleId, a.points])).toEqual([
      ['team', 'research_argumentation', 12],
      ['team', 'research_originality', 0],
      ['team', 'research_completion', 10],
      ['profile', 'research_cited', 15],
    ]);
  });
});
