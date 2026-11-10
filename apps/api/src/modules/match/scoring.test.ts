import { describe, expect, it } from 'vitest';
import { computeFit, growthPlan, rankTasks, teamLevel, type TaskInput, type TeamInput } from './scoring.js';

const info = new Map(
  ['react', 'python', 'ml-classic', 'docker', 'nlp', 'pandas', 'ux-research'].map((s) => [s, { title: s.toUpperCase() }]),
);

const team: TeamInput = {
  skills: [
    { slug: 'react', level: 2 },
    { slug: 'python', level: 2 },
    { slug: 'pandas', level: 2 },
  ],
  weeklyHours: 10,
  interests: ['ритейл'],
};

const task = (id: string, over: Partial<TaskInput> = {}): TaskInput => ({
  id,
  topic: 'ритейл',
  difficulty: 2,
  estHours: 40,
  skills: [
    { slug: 'python', required: true },
    { slug: 'pandas', required: true },
  ],
  ...over,
});

describe('скоринг Challenge Match', () => {
  it('идеальное совпадение — 100, с объяснением', () => {
    const fit = computeFit(team, task('a'), info);
    expect(fit.score).toBe(100);
    expect(fit.gaps).toEqual([]);
    expect(fit.reasons.join(' ')).toContain('Совпали навыки: PYTHON, PANDAS (обязательных 2 из 2)');
    expect(fit.reasons.join(' ')).toContain('совпадает с интересами');
  });

  it('пробелы, сложность, время и интересы снижают оценку предсказуемо', () => {
    const fit = computeFit(
      team,
      task('b', { topic: 'медицина', difficulty: 3, estHours: 80, skills: [{ slug: 'python', required: true }, { slug: 'nlp', required: true }, { slug: 'docker', required: false }] }),
      info,
    );
    // навыки 2/5, сложность 1-1/2, время 40/80, интерес 0
    expect(fit.components).toEqual({ skills: 0.4, difficulty: 0.5, time: 0.5, interest: 0 });
    expect(fit.score).toBe(Math.round(100 * (0.6 * 0.4 + 0.2 * 0.5 + 0.1 * 0.5)));
    expect(fit.gaps.map((g) => [g.slug, g.required])).toEqual([
      ['nlp', true],
      ['docker', false],
    ]);
    expect(fit.reasons.some((r) => r.includes('на вырост'))).toBe(true);
    expect(fit.reasons.some((r) => r.includes('может не хватить'))).toBe(true);
  });

  it('детерминированность и стабильный порядок', () => {
    const tasks = [task('c', { topic: 'логистика' }), task('a'), task('b', { difficulty: 3 })];
    const r1 = rankTasks(team, tasks, info).map((r) => r.task.id);
    const r2 = rankTasks(team, [...tasks].reverse(), info).map((r) => r.task.id);
    // c и b набирают по 90 (без интереса / задача на вырост) — порядок решает id.
    expect(r1).toEqual(['a', 'b', 'c']);
    expect(r2).toEqual(r1);
  });

  it('уровень команды и план роста', () => {
    expect(teamLevel({ ...team, skills: [] })).toBe(1);
    const harder = [
      task('h1', { difficulty: 3, skills: [{ slug: 'python', required: true }, { slug: 'nlp', required: true }] }),
      task('h2', { difficulty: 3, skills: [{ slug: 'nlp', required: true }] }),
      task('h3', { difficulty: 3, skills: [{ slug: 'docker', required: true }, { slug: 'nlp', required: true }] }),
      task('easy', { difficulty: 1, skills: [{ slug: 'ux-research', required: true }] }),
    ];
    const g = growthPlan(team, harder, info);
    expect(g.teamLevel).toBe(2);
    expect(g.skillsToAdd[0]).toEqual({ slug: 'nlp', title: 'NLP', unlocks: 2 });
    expect(g.skillsToAdd.map((s) => s.slug)).not.toContain('ux-research');
  });
});
