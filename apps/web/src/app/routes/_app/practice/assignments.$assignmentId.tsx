import { createFileRoute } from '@tanstack/react-router';
import { PracticeAssignmentPage } from '@/pages/practice/assignment';

export const Route = createFileRoute('/_app/practice/assignments/$assignmentId')({
  component: function Page() {
    return <PracticeAssignmentPage assignmentId={Route.useParams().assignmentId} />;
  },
});
