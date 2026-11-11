import { createFileRoute, Outlet } from '@tanstack/react-router';
import { guard } from '../../guard';

export const Route = createFileRoute('/_app/practice')({
  beforeLoad: ({ context }) => guard(context.queryClient, ['student', 'teacher']),
  component: Outlet,
});
