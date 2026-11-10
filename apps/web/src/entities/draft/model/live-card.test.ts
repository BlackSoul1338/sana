import { describe, expect, it } from 'vitest';
import { readinessTone, toLiveFields, type FieldState } from './live-card';

const field = (key: FieldState['key'], status: FieldState['status'], extra: Partial<FieldState> = {}): FieldState => ({
  key,
  status,
  value: status === 'missing' ? '' : `${key} value`,
  quote: status === 'missing' ? '' : `${key} quote`,
  weight: 10,
  earned: status === 'ok' ? 10 : status === 'weak' ? 5 : 0,
  quoteVerified: true,
  ...extra,
});

describe('live card', () => {
  it('always shows the seven fields in reading order, even if the API skips some', () => {
    const rows = toLiveFields({ fields: [field('criteria', 'ok'), field('title', 'weak')], changes: [] });
    expect(rows.map((r) => r.key)).toEqual(['title', 'context', 'goal', 'users', 'data', 'constraints', 'criteria']);
    expect(rows.find((r) => r.key === 'goal')).toMatchObject({ status: 'missing', text: '', earned: 0 });
  });

  it('attaches this turn delta and flags unverified quotes', () => {
    const rows = toLiveFields({
      fields: [field('data', 'missing', { quote: 'выдумано', quoteVerified: false })],
      changes: [{ field: 'data', from: 'weak', to: 'missing', delta: -10 }],
    });
    const data = rows.find((r) => r.key === 'data')!;
    expect(data.delta).toBe(-10);
    expect(data.unverified).toBe(true);
    expect(data.text).toBe('');
  });

  it('readiness reaches "ready" at the 80 threshold', () => {
    expect(readinessTone(79)).toBe('mid');
    expect(readinessTone(80)).toBe('ready');
    expect(readinessTone(10)).toBe('low');
  });
});
