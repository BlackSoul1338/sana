import { createClient } from '@supabase/supabase-js';

export type VerifiedToken = { userId: string; email: string | null };
/** Порт проверки токена: в проде — Supabase Auth, в тестах — подставной. */
export type TokenVerifier = (token: string) => Promise<VerifiedToken | null>;

/**
 * Проверка access token Supabase. getClaims проверяет подпись по JWKS для асимметричных ключей
 * и обращается к Auth-серверу для симметричных (локальный стек по умолчанию).
 */
export function supabaseVerifier(url: string, publishableKey: string): TokenVerifier {
  const client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return async (token) => {
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    const claims = data.claims as { sub: string; email?: string; role?: string };
    if (claims.role && claims.role !== 'authenticated') return null;
    return { userId: claims.sub, email: claims.email ?? null };
  };
}

/** Для тестов: токен вида "test:<uuid>". */
export function testVerifier(): TokenVerifier {
  return async (token) => {
    const m = /^test:([0-9a-f-]{36})$/i.exec(token);
    return m?.[1] ? { userId: m[1], email: `${m[1].slice(0, 8)}@test.local` } : null;
  };
}
