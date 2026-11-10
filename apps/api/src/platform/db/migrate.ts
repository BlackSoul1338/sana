import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.js';

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../drizzle');

export async function runMigrations(url: string) {
  const { db } = createDb(url);
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}
