import type { bcb } from '@sana/contracts';
import { FIELD_ORDER, type RawField } from './readiness.js';

/** Нормализация для сверки цитат: регистр, ё/е, кавычки, тире, пробелы, пунктуация по краям. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"“”„'‘’`]/g, '')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,;:!?…-]+|[\s.,;:!?…-]+$/g, '');
}

const MIN_QUOTE = 3;

/**
 * Защита от домысливания: цитата должна дословно (после нормализации) встречаться в репликах бизнеса.
 * Реплики ассистента в корпус не входят — иначе модель могла бы «процитировать» собственный вопрос.
 * Цитату из нескольких фрагментов, склеенных многоточием, проверяем по частям.
 */
export function quoteFound(quote: string, businessCorpus: string): boolean {
  const corpus = normalize(businessCorpus);
  const parts = quote
    .split(/\s*(?:\.{3}|…)\s*/)
    .map(normalize)
    .filter((p) => p.length > 0);
  if (!parts.length || parts.join('').length < MIN_QUOTE) return false;
  return parts.every((p) => corpus.includes(p));
}

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
