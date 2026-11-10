import type { match } from '@sana/contracts';

/** Вход скоринга со стороны команды: только навыки, время и интересы. Персональных признаков тип не допускает. */
export type TeamInput = {
  skills: { slug: string; level: number }[];
  weeklyHours: number;
  interests: string[];
};

export type TaskInput = {
  id: string;
  topic: string;
  difficulty: number;
  estHours: number;
  skills: { slug: string; required: boolean }[];
};

export type SkillInfo = Map<string, { title: string }>;

export const WEIGHTS = { skills: 0.6, difficulty: 0.2, time: 0.1, interest: 0.1 } as const;
export const REQUIRED_WEIGHT = 2;
export const OPTIONAL_WEIGHT = 1;
/** Горизонт проекта для оценки времени: четыре недели. */
export const PROJECT_WEEKS = 4;

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Уровень команды — среднее уровней её навыков (1–3); без навыков — 1. */
export function teamLevel(team: TeamInput): number {
  if (!team.skills.length) return 1;
  const avg = team.skills.reduce((s, x) => s + x.level, 0) / team.skills.length;
  return Math.min(3, Math.max(1, Math.round(avg)));
}

/** Объяснимое соответствие команды задаче: компоненты, совпадения, пробелы и причины текстом. */
export function computeFit(team: TeamInput, task: TaskInput, info: SkillInfo): match.Fit {
  const has = new Set(team.skills.map((s) => s.slug));
  const title = (slug: string) => info.get(slug)?.title ?? slug;

  const matched = task.skills.filter((s) => has.has(s.slug));
  const gaps = task.skills.filter((s) => !has.has(s.slug));
  const total = task.skills.reduce((s, x) => s + (x.required ? REQUIRED_WEIGHT : OPTIONAL_WEIGHT), 0);
  const got = matched.reduce((s, x) => s + (x.required ? REQUIRED_WEIGHT : OPTIONAL_WEIGHT), 0);
  const skills = total ? got / total : 1;

  const level = teamLevel(team);
  const difficulty = 1 - Math.abs(task.difficulty - level) / 2;

  const capacity = team.weeklyHours * PROJECT_WEEKS;
  const time = task.estHours > 0 ? Math.min(1, capacity / task.estHours) : 1;

  const interests = team.interests.map((i) => i.toLowerCase());
  const interest = !interests.length ? 0.5 : interests.includes(task.topic.toLowerCase()) ? 1 : 0;

  const score = Math.round(100 * (WEIGHTS.skills * skills + WEIGHTS.difficulty * difficulty + WEIGHTS.time * time + WEIGHTS.interest * interest));

  const reqTotal = task.skills.filter((s) => s.required).length;
  const reqMatched = matched.filter((s) => s.required).length;
  const reasons: string[] = [];
  reasons.push(
    matched.length
      ? `Совпали навыки: ${matched.map((s) => title(s.slug)).join(', ')} (обязательных ${reqMatched} из ${reqTotal})`
      : `Нет совпадающих навыков (обязательных 0 из ${reqTotal})`,
  );
  if (gaps.length) {
    reasons.push(`Не хватает: ${gaps.map((s) => `${title(s.slug)}${s.required ? ' (обязательный)' : ''}`).join(', ')}`);
  }
  reasons.push(
    task.difficulty > level
      ? `Сложность задачи ${task.difficulty} выше уровня команды ${level} — задача на вырост`
      : task.difficulty < level
        ? `Сложность задачи ${task.difficulty} ниже уровня команды ${level}`
        : `Сложность задачи ${task.difficulty} соответствует уровню команды`,
  );
  reasons.push(
    time >= 1
      ? `Времени хватает: нужно ~${task.estHours} ч, у команды ~${capacity} ч за ${PROJECT_WEEKS} недели`
      : `Времени может не хватить: нужно ~${task.estHours} ч, у команды ~${capacity} ч за ${PROJECT_WEEKS} недели`,
  );
  if (interest === 1) reasons.push(`Тема «${task.topic}» совпадает с интересами команды`);

  return {
    score,
    components: { skills: round2(skills), difficulty: round2(difficulty), time: round2(time), interest: round2(interest) },
    matched: matched.map((s) => ({ slug: s.slug, title: title(s.slug), required: s.required })),
    gaps: gaps.map((s) => ({ slug: s.slug, title: title(s.slug), required: s.required })),
    reasons,
  };
}

/** Ранжирование: соответствие, затем меньше обязательных пробелов, затем id для стабильности. */
export function rankTasks<T extends TaskInput>(team: TeamInput, tasks: T[], info: SkillInfo) {
  return tasks
    .map((task) => ({ task, fit: computeFit(team, task, info) }))
    .sort(
      (a, b) =>
        b.fit.score - a.fit.score ||
        a.fit.gaps.filter((g) => g.required).length - b.fit.gaps.filter((g) => g.required).length ||
        a.task.id.localeCompare(b.task.id),
    );
}

/**
 * Усиление кейса 3: какие навыки добавить, чтобы брать более сложные задачи.
 * unlocks — сколько более сложных задач станут закрыты по обязательным навыкам, если добавить этот навык.
 */
export function growthPlan(team: TeamInput, tasks: TaskInput[], info: SkillInfo): match.Growth {
  const level = teamLevel(team);
  const has = new Set(team.skills.map((s) => s.slug));
  const harder = tasks.filter((t) => t.difficulty > level || (t.difficulty === 3 && level === 3));
  const stats = new Map<string, { unlocks: number; seen: number }>();
  for (const t of harder) {
    const missing = t.skills.filter((s) => s.required && !has.has(s.slug)).map((s) => s.slug);
    for (const slug of missing) {
      const st = stats.get(slug) ?? { unlocks: 0, seen: 0 };
      st.seen++;
      if (missing.length === 1) st.unlocks++;
      stats.set(slug, st);
    }
  }
  const skillsToAdd = [...stats]
    .sort((a, b) => b[1].unlocks - a[1].unlocks || b[1].seen - a[1].seen || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([slug, st]) => ({ slug, title: info.get(slug)?.title ?? slug, unlocks: st.unlocks }));
  return { teamLevel: level, skillsToAdd };
}
