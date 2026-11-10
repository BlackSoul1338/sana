import { createFileRoute, Outlet } from '@tanstack/react-router';
import { guard } from '../../guard';

export const Route = createFileRoute('/_app/_business')({
  beforeLoad: ({ context }) => guard(context.queryClient, ['business']),
  component: Outlet,
});
