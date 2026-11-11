import type { practice } from '@sana/contracts';

/** Gap weight per topic: a wrong quiz answer or a partial criterion +1, a missed criterion +2. */
export function gapTopics(quizWrong: string[], latestChecks: { topic: string; verdict: practice.Verdict | null }[]): Map<string, number> {
  const gaps = new Map<string, number>();
  const add = (t: string, w: number) => gaps.set(t, (gaps.get(t) ?? 0) + w);
  for (const t of quizWrong) add(t, 1);
  for (const c of latestChecks) {
    if (c.verdict === 'partial') add(c.topic, 1);
    if (c.verdict === 'missed') add(c.topic, 2);
  }
  return gaps;
}

export type Candidate = { id: string; title: string; difficulty: number; topics: string[] };

/**
 * Next assignment by the largest gap among assignments the student has not finished;
 * ties go to the easier one, then by title. With no gaps — the easiest untouched assignment.
 */
export function recommendNext(gaps: Map<string, number>, candidates: Candidate[]): { assignmentId: string; title: string; topic: string | null; reason: string } | null {
  if (!candidates.length) return null;
  const scored = candidates.map((c) => {
    const topic = [...new Set(c.topics)].sort((a, b) => (gaps.get(b) ?? 0) - (gaps.get(a) ?? 0))[0] ?? null;
    return { c, weight: c.topics.reduce((s, t) => s + (gaps.get(t) ?? 0), 0), topic };
  });
  scored.sort((a, b) => b.weight - a.weight || a.c.difficulty - b.c.difficulty || a.c.title.localeCompare(b.c.title, 'ru'));
  const best = scored[0]!;
  if (best.weight === 0 || !best.topic)
    return { assignmentId: best.c.id, title: best.c.title, topic: null, reason: 'Пробелов не видно — возьмите следующее задание по сложности.' };
  return { assignmentId: best.c.id, title: best.c.title, topic: best.topic, reason: `Закрепит тему «${best.topic}»: в тесте и проверках здесь были ошибки.` };
}
