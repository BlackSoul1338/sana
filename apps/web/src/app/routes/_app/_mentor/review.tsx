import { createFileRoute } from '@tanstack/react-router';
import { ReviewQueuePage } from '@/pages/review-queue';

export const Route = createFileRoute('/_app/_mentor/review')({
  component: ReviewQueuePage,
});
