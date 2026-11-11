import { bindings, defineConfig } from 'cf/config';

const text = (name: string) => (process.env[name] ? bindings.text(process.env[name]) : undefined);

/**
 * Cloudflare Workers deployment of the API (`cf deploy`).
 * HYPERDRIVE_ID — id of the Hyperdrive config pointing at the Supabase Postgres.
 * Plain settings are read from the shell at deploy time; unset ones fall back to the API defaults.
 * Secrets (SUPABASE_*, GOOGLE_API_KEY) are uploaded separately and never stored here.
 */
export default defineConfig({
  worker: {
    name: 'sana-api',
    entrypoint: './src/worker.ts',
    compatibilityDate: '2026-11-01',
    compatibilityFlags: ['nodejs_compat'],
    observability: { enabled: true },
    env: {
      HYPERDRIVE: bindings.hyperdrive({
        id: process.env.HYPERDRIVE_ID ?? 'local',
        dev: { connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' },
      }),
      SUPABASE_URL: bindings.secret(),
      SUPABASE_PUBLISHABLE_KEY: bindings.secret(),
      SUPABASE_SECRET_KEY: bindings.secret(),
      GOOGLE_API_KEY: bindings.secret(),
      AI_PROVIDER: text('AI_PROVIDER'),
      AI_MODEL_FAST: text('AI_MODEL_FAST'),
      AI_MODEL_STRONG: text('AI_MODEL_STRONG'),
      AI_THINKING_FAST: text('AI_THINKING_FAST'),
      AI_THINKING_STRONG: text('AI_THINKING_STRONG'),
      EVIDENCE_BUCKET: text('EVIDENCE_BUCKET'),
      CORS_ORIGINS: text('CORS_ORIGINS'),
    },
  },
});
