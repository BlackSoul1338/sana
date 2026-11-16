import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { z } from 'zod';
import { Problem, type ErrorCode } from '@sana/contracts';
import type { Actor, Ctx } from './context.js';
import { AppError } from './errors.js';

export type AppEnv = { Variables: { actor: Actor; ctx: Ctx; requestId: string } };

const TITLES: Record<ErrorCode, string> = {
  unauthorized: 'Требуется вход',
  forbidden: 'Недостаточно прав',
  not_found: 'Не найдено',
  conflict: 'Конфликт состояния',
  validation_failed: 'Ошибка валидации',
  business_rule: 'Нарушено правило',
  sensitive_data: 'Найдены чувствительные данные',
  ai_unavailable: 'Модель недоступна',
  turn_limit: 'Лимит ходов исчерпан',
  rate_limited: 'Слишком много запросов',
  internal: 'Внутренняя ошибка',
};

export function problemBody(err: AppError, requestId?: string): Problem {
  return {
    type: `https://sana.local/problems/${err.code}`,
    title: TITLES[err.code],
    status: err.status,
    detail: err.message,
    code: err.code,
    ...(err.errors ? { errors: err.errors } : {}),
    ...(err.details ? { details: err.details } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

export function sendProblem(c: Context, err: AppError) {
  const requestId = c.get('requestId') as string | undefined;
  return c.newResponse(JSON.stringify(problemBody(err, requestId)), err.status, {
    'content-type': 'application/problem+json; charset=utf-8',
  });
}

export function zodIssuesToFieldErrors(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }));
}

/** The module router: request validation failures become a 422 problem+json with the offending fields. */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return sendProblem(c, new AppError('validation_failed', 422, 'Запрос не прошёл проверку', zodIssuesToFieldErrors(result.error)));
      }
    },
  });
}

export const jsonBody = <S extends z.ZodType>(schema: S, description?: string) => ({
  content: { 'application/json': { schema } },
  required: true as const,
  ...(description ? { description } : {}),
});

export const jsonRes = <S extends z.ZodType>(schema: S, description = 'OK') => ({
  content: { 'application/json': { schema } },
  description,
});

const problemRes = (description: string) => ({ content: { 'application/problem+json': { schema: Problem } }, description });

/** The standard set of error responses, used by the docs. */
export const errorResponses = {
  401: problemRes('No or invalid token'),
  403: problemRes('Insufficient permissions'),
  404: problemRes('Resource not found'),
  409: problemRes('State conflict'),
  422: problemRes('Validation error or broken rule'),
  429: problemRes('Too many requests'),
} as const;

export const aiErrorResponses = { ...errorResponses, 502: problemRes('The model was unavailable or broke the schema') } as const;

export const IdParam = z.object({ id: z.uuid() });

export const secured = [{ bearerAuth: [] }];
