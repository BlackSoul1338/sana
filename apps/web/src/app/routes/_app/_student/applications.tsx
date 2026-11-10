import { createFileRoute } from '@tanstack/react-router';
import { ApplicationsPage } from '@/pages/applications';

export const Route = createFileRoute('/_app/_student/applications')({
  component: ApplicationsPage,
});
