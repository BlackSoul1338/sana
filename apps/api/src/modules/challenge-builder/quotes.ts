import type { bcb } from '@sana/contracts';
import { quoteFound } from '../../platform/ai/quotes.js';
import { FIELD_ORDER, type RawField } from './readiness.js';

/**
 * Применяет проверку цитат к ответу модели. Поле со статусом ok/weak без подтверждённой цитаты
 * становится missing — сведения за компанию не придумываются.
 */
export function verifyAnalysis(ai: bcb.AiAnalysis, businessMessages: string[]): RawField[] {
  const corpus = businessMessages.join('\n');
  return FIELD_ORDER.map((key) => {
    const f = ai[key];
    if (f.status === 'missing') return { key, status: 'missing', value: 'не указано', quote: '', quoteVerified: false };
    const ok = quoteFound(f.quote, corpus);
    return ok
      ? { key, status: f.status, value: f.value.trim() || 'не указано', quote: f.quote.trim(), quoteVerified: true }
      : { key, status: 'missing', value: 'не указано', quote: f.quote.trim(), quoteVerified: false };
  });
}
