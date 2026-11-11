import { createFileRoute } from '@tanstack/react-router';
import { PracticeQuizPage } from '@/pages/practice/quiz';

export const Route = createFileRoute('/_app/practice/modules/$moduleId/quiz')({
  component: function Page() {
    return <PracticeQuizPage moduleId={Route.useParams().moduleId} />;
  },
});
