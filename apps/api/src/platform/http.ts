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

/** Роутер модуля: ошибки валидации запроса превращаются в problem+json 422 с полевыми ошибками. */
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

/** Стандартный набор ответов об ошибках для документации. */
export const errorResponses = {
  401: problemRes('Нет или неверный токен'),
  403: problemRes('Недостаточно прав'),
  404: problemRes('Объект не найден'),
  409: problemRes('Конфликт состояния'),
  422: problemRes('Ошибка валидации или нарушено правило'),
} as const;

export const aiErrorResponses = { ...errorResponses, 502: problemRes('Модель недоступна или нарушила схему') } as const;

export const IdParam = z.object({ id: z.uuid() });

export const secured = [{ bearerAuth: [] }];
