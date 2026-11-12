import { AsyncLocalStorage } from 'node:async_hooks';
import { createApp, type App } from './app.js';
import { parseEnv, type Env } from './platform/env.js';
import { openDb, type Db } from './platform/db/client.js';
import { createAiModels } from './platform/ai/index.js';
import { supabaseVerifier } from './platform/auth.js';
import { supabaseStorage } from './platform/storage.js';
import { supabaseAccounts } from './platform/accounts.js';

/**
 * Cloudflare Workers entry. Postgres goes through the HYPERDRIVE binding; other settings are vars and secrets.
 * Bindings can't be read in global scope, so the app is built on the first request and reused by the isolate.
 * The evidence bucket is not created here: it must already exist (the Node server or seed creates it).
 */
type Bindings = Record<string, unknown> & { HYPERDRIVE: { connectionString: string } };
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

const requestDb = new AsyncLocalStorage<Db>();
let instance: { app: App; env: Env } | undefined;

function init(bindings: Bindings) {
  const env = parseEnv({ ...bindings, DATABASE_URL: bindings.HYPERDRIVE.connectionString });
  const app = createApp({
    db: () => {
      const db = requestDb.getStore();
      if (!db) throw new Error('No database connection for this request');
      return db;
    },
    verifier: supabaseVerifier(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY),
    ai: createAiModels(env),
    storage: supabaseStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.EVIDENCE_BUCKET),
    accounts: supabaseAccounts(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
    corsOrigins: env.CORS_ORIGINS,
  });
  return { app, env };
}

export default {
  async fetch(request: Request, bindings: Bindings, ctx: ExecutionContext): Promise<Response> {
    instance ??= init(bindings);
    const { db, sql } = openDb(bindings.HYPERDRIVE.connectionString, 5);
    try {
      return await requestDb.run(db, () => instance!.app.fetch(request));
    } finally {
      ctx.waitUntil(sql.end());
    }
  },
};
