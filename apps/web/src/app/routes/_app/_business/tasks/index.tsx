import { createFileRoute } from '@tanstack/react-router';
import { BusinessTasksPage } from '@/pages/business-tasks';

export const Route = createFileRoute('/_app/_business/tasks/')({
  component: BusinessTasksPage,
});
