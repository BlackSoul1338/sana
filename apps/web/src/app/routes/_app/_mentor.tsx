import { createFileRoute, Outlet } from '@tanstack/react-router';
import { guard } from '../../guard';

export const Route = createFileRoute('/_app/_mentor')({
  beforeLoad: ({ context }) => guard(context.queryClient, ['mentor']),
  component: Outlet,
});
