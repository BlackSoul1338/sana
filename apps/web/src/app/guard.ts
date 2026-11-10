import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { meQuery, resolveAccess, type Me, type Role } from '@/entities/viewer';
import { ApiProblem, supabase } from '@/shared/api';

async function loadViewer(queryClient: QueryClient): Promise<{ hasSession: boolean; me: Me | null }> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { hasSession: false, me: null };
  try {
    return { hasSession: true, me: await queryClient.ensureQueryData(meQuery) };
  } catch (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      await supabase.auth.signOut();
      return { hasSession: false, me: null };
    }
    throw error;
  }
}

export async function guard(queryClient: QueryClient, allowed?: readonly Role[]): Promise<Me> {
  const { hasSession, me } = await loadViewer(queryClient);
  const access = resolveAccess(hasSession, me, allowed);
  if (!access.ok) throw redirect({ to: access.redirectTo });
  return me!;
}

/** For guest-only pages: a signed-in viewer goes to onboarding or home. */
export async function guestOnly(queryClient: QueryClient) {
  const { hasSession, me } = await loadViewer(queryClient);
  if (!hasSession) return;
  const access = resolveAccess(hasSession, me);
  throw redirect({ to: access.ok ? '/' : access.redirectTo });
}
