import { createFileRoute, redirect } from '@tanstack/react-router';
import { meQuery } from '@/entities/viewer';
import { supabase } from '@/shared/api';
import { OnboardingPage } from '@/pages/auth';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: '/sign-in' });
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me.profile) throw redirect({ to: '/' });
  },
  component: OnboardingPage,
});
