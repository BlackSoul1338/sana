import type { ErrorCode } from '@sana/contracts';

export type FieldError = { path: string; message: string };

/** Ошибка предметной области. HTTP-слой превращает её в problem+json (RFC 9457). */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502,
    message: string,
    readonly errors?: FieldError[],
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (msg = 'Требуется вход') => new AppError('unauthorized', 401, msg);
export const forbidden = (msg = 'Недостаточно прав') => new AppError('forbidden', 403, msg);
export const notFound = (what: string) => new AppError('not_found', 404, `${what} не найден(а)`);
export const conflict = (msg: string, details?: Record<string, unknown>) =>
  new AppError('conflict', 409, msg, undefined, details);
export const invalid = (msg: string, errors?: FieldError[]) => new AppError('validation_failed', 422, msg, errors);
export const rule = (msg: string, details?: Record<string, unknown>) =>
  new AppError('business_rule', 422, msg, undefined, details);
