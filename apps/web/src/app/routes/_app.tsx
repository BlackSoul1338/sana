import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '@/widgets/app-shell';
import { guard } from '../guard';

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => ({ me: await guard(context.queryClient) }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
