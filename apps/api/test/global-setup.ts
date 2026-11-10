import postgres from 'postgres';
import { runMigrations } from '../src/platform/db/migrate.js';
import { closeAllDb } from '../src/platform/db/client.js';

/**
 * Отдельная база sana_test в локальном Postgres Supabase.
 * Схема auth заменяется заглушкой с таблицей users — миграциям нужна только ссылка на auth.users(id).
 */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/sana_test');
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  const db = postgres(url.toString(), { max: 1, onnotice: () => {} });
  await db.unsafe(`create schema if not exists auth; create table if not exists auth.users (id uuid primary key, email text)`);
  await db.end();

  await runMigrations(url.toString());
  await closeAllDb();
}
