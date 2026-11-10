import { createFileRoute, Outlet } from '@tanstack/react-router';
import { guard } from '../../guard';

export const Route = createFileRoute('/_app/_student')({
  beforeLoad: ({ context }) => guard(context.queryClient, ['student']),
  component: Outlet,
});
