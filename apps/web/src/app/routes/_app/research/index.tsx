import { createFileRoute } from '@tanstack/react-router';
import { ResearchPage } from '@/pages/research/tasks';

export const Route = createFileRoute('/_app/research/')({
  component: ResearchPage,
});
