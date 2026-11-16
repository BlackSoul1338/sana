import { z } from 'zod';

export const Id = z.uuid();
export const Timestamp = z.iso.datetime({ offset: true });
export const DateOnly = z.iso.date();

/**
 * An enum tolerant of case and spaces: the model or a client may send " OK ".
 * In the JSON Schema (for the model and OpenAPI) it stays a plain string enum.
 */
export function looseEnum<const T extends readonly [string, ...string[]]>(values: T, description?: string) {
  return z
    .preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(values))
    .meta({ type: 'string', enum: [...values], ...(description ? { description } : {}) });
}

export const Role = z.enum(['student', 'mentor', 'business', 'teacher']).meta({ id: 'Role', description: 'The user role on the platform' });
export type Role = z.infer<typeof Role>;

export const Difficulty = z.number().int().min(1).max(3).meta({ description: 'Difficulty from 1 to 3' });

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable().meta({ description: 'The cursor of the next page, or null' }),
  });

export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const Ok = z.object({ ok: z.literal(true) }).meta({ id: 'Ok' });
