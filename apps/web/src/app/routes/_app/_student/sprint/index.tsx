import { createFileRoute } from '@tanstack/react-router';
import { SprintProjectsPage } from '@/pages/sprint-projects';

export const Route = createFileRoute('/_app/_student/sprint/')({
  component: SprintProjectsPage,
});
