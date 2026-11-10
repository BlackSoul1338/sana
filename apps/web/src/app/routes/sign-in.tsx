import { createFileRoute } from '@tanstack/react-router';
import { SignInPage } from '@/pages/auth';
import { guestOnly } from '../guard';

export const Route = createFileRoute('/sign-in')({
  beforeLoad: ({ context }) => guestOnly(context.queryClient),
  component: SignInPage,
});
