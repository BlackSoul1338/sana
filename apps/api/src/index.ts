import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env } from './platform/env.js';
import { createDb } from './platform/db/client.js';
import { createAiModels } from './platform/ai/index.js';
import { supabaseVerifier } from './platform/auth.js';
import { supabaseStorage } from './platform/storage.js';
import { supabaseAccounts } from './platform/accounts.js';

const e = env();
const { db } = createDb(e.DATABASE_URL);
const storage = supabaseStorage(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, e.EVIDENCE_BUCKET);
await storage.ensureBucket();

const ai = createAiModels(e);
const app = createApp({ db, verifier: supabaseVerifier(e.SUPABASE_URL, e.SUPABASE_PUBLISHABLE_KEY), ai, storage, accounts: supabaseAccounts(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY), corsOrigins: e.CORS_ORIGINS });

serve({ fetch: app.fetch, port: e.PORT }, (info) => {
  console.log(`AI Sana API: http://localhost:${info.port}  (документация: /docs, AI: ${ai ? `${ai.provider} ${e.AI_MODEL_FAST}/${e.AI_MODEL_STRONG || e.AI_MODEL_FAST}` : 'выключен'})`);
});
