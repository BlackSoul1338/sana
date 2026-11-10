import { z } from 'zod';

export const ErrorCode = z
  .enum([
    'unauthorized',
    'forbidden',
    'not_found',
    'conflict',
    'validation_failed',
    'business_rule',
    'sensitive_data',
    'ai_unavailable',
    'turn_limit',
    'internal',
  ])
  .meta({ id: 'ErrorCode' });
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Ответ об ошибке в формате RFC 9457 (application/problem+json). */
export const Problem = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    code: ErrorCode,
    errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
  })
  .meta({ id: 'Problem' });
export type Problem = z.infer<typeof Problem>;
