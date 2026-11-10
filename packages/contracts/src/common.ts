import { z } from 'zod';

export const Id = z.uuid();
export const Timestamp = z.iso.datetime({ offset: true });
export const DateOnly = z.iso.date();

/**
 * Enum, устойчивый к регистру и пробелам: модель или клиент может прислать " OK ".
 * В JSON Schema (для модели и OpenAPI) остаётся обычный строковый enum.
 */
export function looseEnum<const T extends readonly [string, ...string[]]>(values: T, description?: string) {
  return z
    .preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(values))
    .meta({ type: 'string', enum: [...values], ...(description ? { description } : {}) });
}

export const Role = z.enum(['student', 'mentor', 'business']).meta({ id: 'Role', description: 'Роль пользователя на платформе' });
export type Role = z.infer<typeof Role>;

export const Difficulty = z.number().int().min(1).max(3).meta({ description: 'Сложность от 1 до 3' });

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable().meta({ description: 'Курсор следующей страницы или null' }),
  });

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const Ok = z.object({ ok: z.literal(true) }).meta({ id: 'Ok' });
