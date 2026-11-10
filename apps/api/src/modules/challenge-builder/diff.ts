import type { bcb } from '@sana/contracts';
import { FIELD_ORDER } from './readiness.js';
import type { FieldChangeT, FieldState } from './types.js';

/** Что изменилось между соседними снимками: поле, статус до и после, прирост готовности. */
export function fieldChanges(prev: FieldState[] | null, next: FieldState[]): FieldChangeT[] {
  if (!prev) return [];
  return FIELD_ORDER.flatMap((key) => {
    const a = prev.find((f) => f.key === key);
    const b = next.find((f) => f.key === key);
    if (!a || !b || a.status === b.status) return [];
    return [{ field: key, from: a.status, to: b.status, delta: Math.round((b.earned - a.earned) * 10) / 10 }];
  });
}

export type Snapshot = { turn: number; readiness: number; fields: FieldState[]; changes: FieldChangeT[]; answer: string };

/** Сравнение «до и после» без вызова модели: первый и последний снимки плюс вклад каждого ответа. */
export function buildDiff(snapshots: Snapshot[]): bcb.DraftDiff | null {
  if (!snapshots.length) return null;
  const sorted = [...snapshots].sort((a, b) => a.turn - b.turn);
  const first = sorted[0]!;
  const last = sorted.at(-1)!;
  return {
    before: { readiness: first.readiness, fields: first.fields },
    after: { readiness: last.readiness, fields: last.fields },
    steps: sorted.slice(1).map((s, i) => ({
      turn: s.turn,
      answer: s.answer.length > 300 ? `${s.answer.slice(0, 297)}…` : s.answer,
      readinessDelta: s.readiness - sorted[i]!.readiness,
      changes: s.changes,
    })),
  };
}
