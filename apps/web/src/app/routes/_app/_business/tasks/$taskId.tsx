import { createFileRoute } from '@tanstack/react-router';
import { taskQuery } from '@/entities/task';
import { BusinessTaskPage } from '@/pages/business-task';

export const Route = createFileRoute('/_app/_business/tasks/$taskId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(taskQuery(params.taskId)),
  component: function Page() {
    return <BusinessTaskPage taskId={Route.useParams().taskId} />;
  },
});
