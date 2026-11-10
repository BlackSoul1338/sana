import { describe, expect, it } from 'vitest';
import { awardsForApproval, speedBonus, submittedOnTime, type ApprovalFacts } from './rules.js';
import { earnedAchievements } from './achievements.js';
import { chooseNextStep } from './next-step.js';

const base = (over: Partial<ApprovalFacts> = {}): ApprovalFacts => ({
  evidence: { id: 'ev1', kind: 'report', url: null, submittedAt: new Date('2026-11-05T10:00:00Z'), submittedBy: 'p1' },
  project: { id: 'pr1', teamId: 't1' },
  interviewsCounted: 0,
  techUsed: [],
  prototypeApproved: false,
  ...over,
});

const sum = (a: { points: number }[]) => a.reduce((s, x) => s + x.points, 0);

describe('правила Startup Sprint', () => {
  it('этап в срок: баллы этапа + 10% бонуса (с потолком)', () => {
    const awards = awardsForApproval(base({ stage: { key: 'problem', plannedAt: '2026-11-05' } }));
    expect(awards.map((a) => a.ruleId)).toEqual(['stage_completed', 'speed_bonus']);
    expect(sum(awards)).toBe(22);
    expect(awards.every((a) => a.subjectType === 'team' && a.subjectId === 't1')).toBe(true);
  });

  it('бонус за скорость не больше 5 и только от баллов этапа', () => {
    expect(speedBonus(40, new Date('2026-11-01T00:00:00Z'), '2026-11-02')).toBe(4);
    expect(speedBonus(100, new Date('2026-11-01T00:00:00Z'), '2026-11-02')).toBe(5);
    expect(speedBonus(0, new Date('2026-11-01T00:00:00Z'), '2026-11-02')).toBe(0);
    expect(submittedOnTime(new Date('2026-11-02T23:59:00Z'), '2026-11-02')).toBe(true);
    expect(submittedOnTime(new Date('2026-11-03T00:00:01Z'), '2026-11-02')).toBe(false);
  });

  it('просроченный этап — без бонуса', () => {
    const awards = awardsForApproval(base({ stage: { key: 'idea', plannedAt: '2026-11-01' } }));
    expect(awards.map((a) => a.ruleId)).toEqual(['stage_completed']);
    expect(sum(awards)).toBe(10);
  });

  it('прототип по ссылке: этап + работающий прототип + технологии (без дублей)', () => {
    const awards = awardsForApproval(
      base({
        evidence: { id: 'ev2', kind: 'link', url: 'https://demo.app', submittedAt: new Date('2026-12-01T00:00:00Z'), submittedBy: 'p1' },
        stage: { key: 'prototype', plannedAt: '2026-11-20' },
        techUsed: [
          { slug: 'react', title: 'React', difficulty: 2 },
          { slug: 'react', title: 'React', difficulty: 2 },
          { slug: 'deep-learning', title: 'DL', difficulty: 3 },
        ],
      }),
    );
    expect(awards.map((a) => a.ruleId).sort()).toEqual(['stage_completed', 'tech_complexity', 'tech_complexity', 'working_prototype']);
    expect(sum(awards)).toBe(40 + 30 + 10 + 15);
  });

  it('прототип скриншотом — без бонуса «работающий прототип»', () => {
    const awards = awardsForApproval(base({ evidence: { ...base().evidence, kind: 'screenshot' }, stage: { key: 'prototype', plannedAt: '2026-11-01' } }));
    expect(awards.some((a) => a.ruleId === 'working_prototype')).toBe(false);
  });

  it('интервью засчитываются до пяти', () => {
    const fourth = awardsForApproval(base({ evidence: { ...base().evidence, kind: 'interview' }, interviewsCounted: 4 }));
    expect(fourth).toHaveLength(1);
    expect(fourth[0]!.explanation).toContain('5 из 5');
    const sixth = awardsForApproval(base({ evidence: { ...base().evidence, kind: 'interview' }, interviewsCounted: 5 }));
    expect(sixth).toHaveLength(0);
  });

  it('задача: личные баллы исполнителю по сложности навыка; после прототипа — технология команде', () => {
    const awards = awardsForApproval(
      base({ task: { id: 'tk1', title: 'API', assigneeId: 'p9', skill: { slug: 'nodejs', title: 'Node.js', difficulty: 2 } }, prototypeApproved: true }),
    );
    const personal = awards.find((a) => a.ruleId === 'task_done')!;
    expect(personal).toMatchObject({ subjectType: 'profile', subjectId: 'p9', points: 10 });
    expect(awards.find((a) => a.ruleId === 'tech_complexity')).toMatchObject({ subjectType: 'team', points: 10 });
    const noSkill = awardsForApproval(base({ task: { id: 'tk2', title: 'Питч', assigneeId: null, skill: null } }));
    expect(noSkill).toEqual([expect.objectContaining({ subjectId: 'p1', points: 5 })]);
  });

  it('ключи идемпотентности стабильны для одних и тех же фактов', () => {
    const f = base({ stage: { key: 'idea', plannedAt: '2026-11-10' } });
    expect(awardsForApproval(f).map((a) => a.idempotencyKey)).toEqual(awardsForApproval(f).map((a) => a.idempotencyKey));
  });
});

describe('достижения', () => {
  it('выдаются по фактам проекта', () => {
    expect(earnedAchievements({ approvedStages: [], approvedInterviews: 0, hasWorkingPrototype: false, linkedToBusinessTask: false })).toEqual([]);
    expect(
      earnedAchievements({
        approvedStages: ['idea', 'problem', 'interviews', 'prototype', 'testing'],
        approvedInterviews: 5,
        hasWorkingPrototype: true,
        linkedToBusinessTask: true,
      }),
    ).toEqual(['first_step', 'first_interview', 'five_interviews', 'mvp_ready', 'all_stages', 'real_task']);
  });
});

describe('следующий шаг', () => {
  const stages = (statuses: Record<string, 'open' | 'submitted' | 'approved' | 'rejected'>) =>
    (['idea', 'problem', 'interviews', 'prototype', 'testing'] as const).map((key, i) => ({
      key,
      status: statuses[key] ?? 'open',
      plannedAt: `2026-11-${String(10 + i * 3).padStart(2, '0')}`,
    }));

  it('на этапе прототипа выбирает прототип (этап + работающий прототип + скорость)', () => {
    const choice = chooseNextStep({
      stages: stages({ idea: 'approved', problem: 'approved', interviews: 'approved' }),
      approvedInterviews: 5,
      pendingInterviews: 0,
      hasWorkingPrototype: false,
      now: new Date('2026-11-01T00:00:00Z'),
    });
    expect(choice).toMatchObject({ ruleId: 'working_prototype', potentialPoints: 40 + 4 + 30 });
  });

  it('если этап на проверке — предлагает интервью', () => {
    const choice = chooseNextStep({
      stages: stages({ idea: 'approved', problem: 'submitted' }),
      approvedInterviews: 1,
      pendingInterviews: 1,
      hasWorkingPrototype: false,
      now: new Date('2026-11-01T00:00:00Z'),
    });
    expect(choice).toMatchObject({ ruleId: 'interview', potentialPoints: 30 });
  });

  it('всё пройдено — шагов нет', () => {
    const all = stages({ idea: 'approved', problem: 'approved', interviews: 'approved', prototype: 'approved', testing: 'approved' });
    expect(chooseNextStep({ stages: all, approvedInterviews: 5, pendingInterviews: 0, hasWorkingPrototype: true, now: new Date() })).toBeNull();
  });
});
