import { createClient } from '@supabase/supabase-js';
import { env } from '@/shared/config';

/** Auth and signed Storage uploads only: tables are closed by RLS, data goes through the API. */
export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const EVIDENCE_BUCKET = 'evidence';
