import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/pages/team';

export const Route = createFileRoute('/_app/_student/team')({
  component: TeamPage,
});
