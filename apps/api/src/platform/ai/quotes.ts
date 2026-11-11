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
 * Guard against invented facts: a model's quote must appear verbatim (after normalization) in the user's own text.
 * Callers pass only what the user wrote, never the assistant's turns, so the model cannot quote itself.
 * A quote made of fragments joined by an ellipsis is checked part by part.
 */
export function quoteFound(quote: string, userCorpus: string): boolean {
  const corpus = normalize(userCorpus);
  const parts = quote
    .split(/\s*(?:\.{3}|…)\s*/)
    .map(normalize)
    .filter((p) => p.length > 0);
  if (!parts.length || parts.join('').length < MIN_QUOTE) return false;
  return parts.every((p) => corpus.includes(p));
}
