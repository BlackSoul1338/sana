import { createFileRoute } from '@tanstack/react-router';
import { ReviewQueuePage } from '@/pages/review-queue';
import { guard } from '../../guard';

export const Route = createFileRoute('/_app/review')({
  beforeLoad: ({ context }) => guard(context.queryClient, ['mentor', 'teacher']),
  component: ReviewQueuePage,
});
