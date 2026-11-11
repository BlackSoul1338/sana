/**
 * Practice Lab check on the synthetic answers (live model): mean preliminary points of strong answers
 * must exceed medium, medium must exceed weak; strong answers must have every criterion checked.
 * No database: the same check and scoring code as the API.
 *   pnpm eval:practice
 */
import { createAiModels } from '../src/platform/ai/index.js';
import { env } from '../src/platform/env.js';
import { checkAttempt } from '../src/modules/practice/ai.js';
import { scoreCheck, verifyCheck } from '../src/modules/practice/rules.js';
import { readData } from '../src/seed/refs.js';

type AssignmentJson = { title: string; condition: string; criteria: { title: string; description: string; topic: string; maxPoints: number }[] };
type AnswerJson = { assignment: string; quality: 'weak' | 'medium' | 'strong'; answer: string };

const assignments = readData<AssignmentJson[]>('practice-assignments.json');
const answers = readData<AnswerJson[]>('practice-answers.json');
const ai = createAiModels(env());
if (!ai) {
  console.error('AI не настроен: AI_PROVIDER=google, GOOGLE_API_KEY, AI_MODEL_FAST');
  process.exit(1);
}

const rows: (AnswerJson & { points: number; max: number; unchecked: number; dropped: number; error?: string })[] = [];
// Sequential: free Gemini keys are rate-limited per minute.
for (const it of answers) {
  const a = assignments.find((x) => x.title === it.assignment)!;
  const criteria = a.criteria.map((c, i) => ({ ...c, id: `k${i + 1}` }));
  const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
  try {
    const check = verifyCheck(await checkAttempt(ai, { condition: a.condition, criteria }, it.answer), criteria, it.answer);
    rows.push({ ...it, points: scoreCheck(criteria, check).correctness, max, unchecked: check.criteria.filter((c) => !c.verdict).length, dropped: check.droppedQuotes });
  } catch (err) {
    rows.push({ ...it, points: -1, max, unchecked: 0, dropped: 0, error: (err as Error).message });
  }
}

for (const r of rows) console.log(`${r.quality.padEnd(7)} ${String(r.points).padStart(3)}/${r.max}  не проверено ${r.unchecked}  отбр. цитат ${r.dropped}  ${r.assignment}${r.error ? `  ОШИБКА: ${r.error}` : ''}`);
const ok = rows.filter((r) => r.points >= 0);
const mean = (q: AnswerJson['quality']) => {
  const xs = ok.filter((r) => r.quality === q).map((r) => r.points / r.max);
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
};
const m = { weak: mean('weak'), medium: mean('medium'), strong: mean('strong') };
console.log(`\nДоля баллов: слабые ${m.weak.toFixed(2)}, средние ${m.medium.toFixed(2)}, сильные ${m.strong.toFixed(2)}`);
const pass = ok.length === rows.length && m.strong > m.medium && m.medium > m.weak && ok.filter((r) => r.quality === 'strong').every((r) => r.unchecked === 0);
console.log(pass ? 'OK' : 'FAIL');
process.exit(pass ? 0 : 1);
