import { pgSchema, uuid } from 'drizzle-orm/pg-core';

/**
 * Ссылка на таблицу Supabase Auth только для внешних ключей.
 * Файл не входит в glob схем drizzle-kit, поэтому миграции схему auth не трогают.
 */
export const authUsers = pgSchema('auth').table('users', {
  id: uuid('id').primaryKey(),
});
