import { createFileRoute } from '@tanstack/react-router';
import { SignUpPage } from '@/pages/auth';
import { guestOnly } from '../guard';

export const Route = createFileRoute('/sign-up')({
  beforeLoad: ({ context }) => guestOnly(context.queryClient),
  component: SignUpPage,
});
