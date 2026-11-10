import { createFileRoute } from '@tanstack/react-router';
import { taskQuery } from '@/entities/task';
import { ChallengePage } from '@/pages/challenge';

export const Route = createFileRoute('/_app/_student/challenges/$taskId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(taskQuery(params.taskId)),
  component: function Page() {
    return <ChallengePage taskId={Route.useParams().taskId} />;
  },
});
