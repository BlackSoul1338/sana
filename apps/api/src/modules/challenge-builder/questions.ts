import type { CardFieldKey } from '@sana/contracts';
import { FIELD_TITLES, FIELD_WEIGHTS, STATUS_FACTOR } from './readiness.js';
import type { FieldState, Question } from './types.js';

/** Запасные формулировки, если модель не дала вопрос к полю. */
export const FALLBACK_QUESTIONS: Record<CardFieldKey, { missing: string; weak: string; refine: string }> = {
  title: {
    missing: 'Как коротко назвать задачу — одной фразой, понятной студентам?',
    weak: 'Можно ли уточнить название, чтобы из него было ясно, что нужно сделать?',
    refine: 'Устраивает ли вас рабочее название задачи или хотите его уточнить?',
  },
  context: {
    missing: 'В каком процессе компании возникает проблема и как он устроен сейчас?',
    weak: 'Опишите подробнее текущий процесс: кто участвует, на каком шаге возникает проблема?',
    refine: 'Есть ли ещё детали процесса, которые важно знать команде до старта?',
  },
  goal: {
    missing: 'Чего компания хочет добиться, решив эту задачу?',
    weak: 'Как будет выглядеть успех в цифрах — например, на сколько должен измениться показатель?',
    refine: 'Есть ли второстепенные цели, кроме основной?',
  },
  users: {
    missing: 'Кто сталкивается с этой проблемой: сотрудники, клиенты, партнёры? Сколько их примерно?',
    weak: 'Уточните, какие именно группы пользователей затрагивает проблема и чем они отличаются?',
    refine: 'Сможет ли команда поговорить с этими пользователями во время работы?',
  },
  data: {
    missing: 'Какие данные вы можете дать команде: набор, формат, объём и кто предоставит доступ?',
    weak: 'Уточните формат и объём данных, а также как и когда команда получит доступ?',
    refine: 'Нужно ли обезличить данные перед передачей команде?',
  },
  constraints: {
    missing: 'Какие есть ограничения: сроки, закрытые данные, допустимые или запрещённые технологии?',
    weak: 'Уточните ограничения: до какого срока нужен результат и что нельзя использовать?',
    refine: 'Есть ли требования к размещению решения или к безопасности?',
  },
  criteria: {
    missing: 'По какому измеримому показателю вы поймёте, что задача решена, и какой нужен порог?',
    weak: 'Какой конкретный порог показателя будет считаться успехом?',
    refine: 'Как и кто будет проверять результат на приёмке?',
  },
};

export const FIRST_ROUND_MIN = 3;
export const NEXT_ROUND_MAX = 3;

/**
 * Вопросы выбираются по потерянному весу поля: первым почти всегда уходит вопрос о данных или измеримом критерии.
 * Первый ход — не меньше трёх вопросов (при нехватке пробелов добавляются уточняющие к самым весомым полям),
 * дальше — до трёх вопросов только по пробелам.
 */
export function selectQuestions(input: { fields: FieldState[]; aiQuestions: Question[]; turn: number }): Question[] {
  const gaps = input.fields
    .filter((f) => f.status !== 'ok')
    .map((f) => ({ f, lost: FIELD_WEIGHTS[f.key] * (1 - STATUS_FACTOR[f.status]) }))
    .sort((a, b) => b.lost - a.lost || FIELD_WEIGHTS[b.f.key] - FIELD_WEIGHTS[a.f.key]);

  const textFor = (key: CardFieldKey, kind: 'missing' | 'weak' | 'refine') => {
    const fromAi = input.aiQuestions.find((q) => q.field === key)?.text.trim();
    return kind !== 'refine' && fromAi && fromAi.length >= 8 ? fromAi : FALLBACK_QUESTIONS[key][kind];
  };

  const out: Question[] = gaps.map(({ f }) => ({ field: f.key, text: textFor(f.key, f.status === 'weak' ? 'weak' : 'missing') }));

  if (input.turn === 1) {
    if (out.length < FIRST_ROUND_MIN) {
      const byWeight = input.fields.filter((f) => f.status === 'ok').sort((a, b) => FIELD_WEIGHTS[b.key] - FIELD_WEIGHTS[a.key]);
      for (const f of byWeight) {
        if (out.length >= FIRST_ROUND_MIN) break;
        out.push({ field: f.key, text: textFor(f.key, 'refine') });
      }
    }
    return out.slice(0, Math.max(FIRST_ROUND_MIN, Math.min(out.length, 4)));
  }
  return out.slice(0, NEXT_ROUND_MAX);
}

export const questionsMessage = (qs: Question[]) =>
  qs.length
    ? `Чтобы карточка была полной, уточните, пожалуйста:\n${qs.map((q, i) => `${i + 1}. [${FIELD_TITLES[q.field]}] ${q.text}`).join('\n')}`
    : 'Сведений достаточно — можно собрать карточку задачи.';
