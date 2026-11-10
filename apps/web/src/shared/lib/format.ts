const dayMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const full = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' });

/** "12 окт" for both ISO timestamps and YYYY-MM-DD dates. */
export function formatDay(value: string): string {
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return dayMonth.format(d).replace('.', '');
}

export function formatDateTime(value: string): string {
  return full.format(new Date(value));
}

export function formatRelative(value: string, now = Date.now()): string {
  const diff = (new Date(value).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'только что';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDay(value);
}

/** plural(5, ['балл', 'балла', 'баллов']) → "баллов" */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function points(n: number): string {
  return `${n} ${plural(n, ['балл', 'балла', 'баллов'])}`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
