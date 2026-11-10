/**
 * Проверка конструктора на 15 синтетических описаниях (живая модель):
 * готовность сильных описаний должна быть выше средних, средних — выше слабых;
 * в первом ходе — не меньше трёх вопросов. Без БД: тот же код анализа, что и в API.
 *   pnpm eval:bcb
 */
import { createAiModels } from '../src/platform/ai/index.js';
import { env } from '../src/platform/env.js';
import { analyzeDraft } from '../src/modules/challenge-builder/ai/functions.js';
import { verifyAnalysis } from '../src/modules/challenge-builder/quotes.js';
import { scoreFields } from '../src/modules/challenge-builder/readiness.js';
import { selectQuestions } from '../src/modules/challenge-builder/questions.js';
import { readData } from '../src/seed/refs.js';

type Item = { id: number; quality: 'weak' | 'medium' | 'strong'; text: string };
const items = readData<Item[]>('bcb-descriptions.json');
const ai = createAiModels(env());
if (!ai) {
  console.error('AI не настроен: AI_PROVIDER=google, GOOGLE_API_KEY, AI_MODEL_FAST');
  process.exit(1);
}

type Row = Item & { readiness: number; questions: number; unverified: number; seconds: number; statuses: string; error?: string };
const rows: Row[] = [];
// Бесплатные ключи Gemini ограничены по запросам в минуту — по умолчанию последовательно.
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 1);
let next = 0;
async function worker() {
  while (next < items.length) {
    const it = items[next++]!;
    const started = Date.now();
    try {
      const out = await analyzeDraft(ai, [{ role: 'user', text: it.text }]);
      const verified = verifyAnalysis(out, [it.text]);
      const { readiness, fields } = scoreFields(verified);
      const qs = selectQuestions({ fields, aiQuestions: out.questions, turn: 1 });
      const unverified = verified.filter((f) => !f.quoteVerified && out[f.key].status !== 'missing').length;
      rows.push({ ...it, readiness, questions: qs.length, unverified, seconds: (Date.now() - started) / 1000, statuses: fields.map((f) => f.status[0]).join('') });
    } catch (err) {
      rows.push({ ...it, readiness: -1, questions: 0, unverified: 0, seconds: (Date.now() - started) / 1000, statuses: '', error: (err as Error).message });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
rows.sort((a, b) => a.id - b.id);

console.log('\n id  качество  готовность  вопросов  отбр.цитат  поля(t c g u d s k)  сек');
for (const r of rows) {
  console.log(
    `${String(r.id).padStart(3)}  ${r.quality.padEnd(8)}  ${String(r.readiness).padStart(10)}  ${String(r.questions).padStart(8)}  ${String(r.unverified).padStart(10)}  ${r.statuses.padEnd(19)}  ${r.seconds.toFixed(1)}${r.error ? `  ОШИБКА: ${r.error}` : ''}`,
  );
}
const ok = rows.filter((r) => r.readiness >= 0);
const mean = (q: Item['quality']) => {
  const xs = ok.filter((r) => r.quality === q).map((r) => r.readiness);
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;
};
const m = { weak: mean('weak'), medium: mean('medium'), strong: mean('strong') };
console.log(`\nСредняя готовность: слабые ${m.weak.toFixed(1)}, средние ${m.medium.toFixed(1)}, сильные ${m.strong.toFixed(1)}`);
const checks = {
  'порядок слабые < средние < сильные': m.weak < m.medium && m.medium < m.strong,
  'каждый сильный выше каждого слабого': Math.min(...ok.filter((r) => r.quality === 'strong').map((r) => r.readiness)) > Math.max(...ok.filter((r) => r.quality === 'weak').map((r) => r.readiness)),
  'в первом ходе ≥3 вопросов': ok.every((r) => r.questions >= 3),
  'все вызовы успешны': ok.length === rows.length,
};
for (const [name, pass] of Object.entries(checks)) console.log(`${pass ? '✔' : '✘'} ${name}`);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
