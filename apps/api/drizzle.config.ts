import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/core/*/schema.ts', './src/modules/*/schema.ts'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' },
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
