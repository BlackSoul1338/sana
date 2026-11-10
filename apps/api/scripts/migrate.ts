import { runMigrations } from '../src/platform/db/migrate.js';
import { closeAllDb } from '../src/platform/db/client.js';
import { env } from '../src/platform/env.js';

await runMigrations(env().DATABASE_URL);
await closeAllDb();
console.log('Миграции применены');
