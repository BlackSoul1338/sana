import { createFileRoute } from '@tanstack/react-router';
import { MentorProjectsPage } from '@/pages/mentor-projects';

export const Route = createFileRoute('/_app/_mentor/projects/')({
  component: MentorProjectsPage,
});
