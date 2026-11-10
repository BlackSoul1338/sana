import type { Me, Role } from './me';
import { ROLE_HOME } from './me';

export type Access = { ok: true } | { ok: false; redirectTo: string };

/** Where a viewer may go: sign-in without a session, onboarding without a profile, own home on a foreign section. */
export function resolveAccess(hasSession: boolean, me: Me | null, allowed?: readonly Role[]): Access {
  if (!hasSession || !me) return { ok: false, redirectTo: '/sign-in' };
  if (!me.profile) return { ok: false, redirectTo: '/onboarding' };
  if (allowed && !allowed.includes(me.profile.role)) return { ok: false, redirectTo: ROLE_HOME[me.profile.role] };
  return { ok: true };
}
