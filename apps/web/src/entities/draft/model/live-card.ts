import type { Schemas } from '@/shared/api';
import { CARD_FIELD_ORDER, CARD_FIELDS, READY_THRESHOLD, type CardFieldKey } from '@/shared/config';

export type TurnResult = Schemas['TurnResult'];
export type FieldState = Schemas['FieldState'];
export type FieldStatus = FieldState['status'];

export type LiveField = {
  key: CardFieldKey;
  label: string;
  status: FieldStatus;
  earned: number;
  weight: number;
  text: string;
  /** Claimed by the model but not found in the business's own words. */
  unverified: boolean;
  delta: number;
};

/** Card fields in the fixed reading order, with this turn's changes attached. */
export function toLiveFields(turn: Pick<TurnResult, 'fields' | 'changes'>): LiveField[] {
  const byKey = new Map(turn.fields.map((f) => [f.key, f]));
  const deltas = new Map(turn.changes.map((c) => [c.field, c.delta]));
  return CARD_FIELD_ORDER.map((key) => {
    const f = byKey.get(key);
    return {
      key,
      label: CARD_FIELDS[key].label,
      status: f?.status ?? 'missing',
      earned: f?.earned ?? 0,
      weight: f?.weight ?? CARD_FIELDS[key].weight,
      text: f && f.status !== 'missing' ? f.value || f.quote : '',
      unverified: !!f && !f.quoteVerified && f.quote !== '',
      delta: deltas.get(key) ?? 0,
    };
  });
}

export function readinessTone(readiness: number): 'low' | 'mid' | 'ready' {
  if (readiness >= READY_THRESHOLD) return 'ready';
  return readiness >= READY_THRESHOLD / 2 ? 'mid' : 'low';
}
