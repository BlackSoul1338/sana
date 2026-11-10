import { createFileRoute } from '@tanstack/react-router';
import { ChallengesPage } from '@/pages/challenges';

export const Route = createFileRoute('/_app/_student/challenges/')({
  component: ChallengesPage,
});
