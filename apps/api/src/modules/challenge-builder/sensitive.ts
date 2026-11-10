import type { bcb } from '@sana/contracts';

type Finding = bcb.SensitiveFinding;

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
const PHONE = /(?<![\d])(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\d])/g;
const TWELVE_DIGITS = /(?<!\d)\d{12}(?!\d)/g;
const CARD = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;

/**
 * ИИН Казахстана: 12 цифр, первые шесть — дата рождения ГГММДД, последняя — контрольная.
 * Алгоритм: веса 1..11 по модулю 11; если результат 10 — веса 3..11,1,2; если снова 10 — номер недействителен.
 */
export function isValidIin(iin: string): boolean {
  if (!/^\d{12}$/.test(iin)) return false;
  const d = iin.split('').map(Number);
  const month = d[2]! * 10 + d[3]!;
  const day = d[4]! * 10 + d[5]!;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const w1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const w2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
  let c = w1.reduce((s, w, i) => s + w * d[i]!, 0) % 11;
  if (c === 10) {
    c = w2.reduce((s, w, i) => s + w * d[i]!, 0) % 11;
    if (c === 10) return false;
  }
  return c === d[11];
}

export function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const mask = (s: string) => (s.length <= 4 ? '****' : `${s.slice(0, 2)}${'*'.repeat(Math.max(3, s.length - 4))}${s.slice(-2)}`);

/**
 * Поиск персональных данных в тексте. Контрольные суммы отсекают ложные срабатывания
 * на бюджетах, артикулах и прочих длинных числах.
 */
export function findSensitive(text: string, where: string): Finding[] {
  const out: Finding[] = [];
  for (const m of text.matchAll(EMAIL)) out.push({ kind: 'email', excerpt: mask(m[0]), where });
  for (const m of text.matchAll(PHONE)) out.push({ kind: 'phone', excerpt: mask(m[0].replace(/\D/g, '')), where });
  for (const m of text.matchAll(TWELVE_DIGITS)) if (isValidIin(m[0])) out.push({ kind: 'iin', excerpt: mask(m[0]), where });
  for (const m of text.matchAll(CARD)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits) && !(digits.length === 12 && isValidIin(digits))) {
      out.push({ kind: 'card', excerpt: mask(digits), where });
    }
  }
  return out;
}

export function scanAll(items: { text: string; where: string }[]): Finding[] {
  return items.flatMap((i) => findSensitive(i.text, i.where));
}
