import { createFileRoute, redirect } from '@tanstack/react-router';
import { ROLE_HOME } from '@/entities/viewer';

export const Route = createFileRoute('/_app/')({
  beforeLoad: ({ context }) => {
    throw redirect({ to: ROLE_HOME[context.me.profile!.role] });
  },
});
