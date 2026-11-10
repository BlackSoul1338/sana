import { createFileRoute } from '@tanstack/react-router';
import { projectQuery } from '@/entities/project';
import { SprintProjectPage } from '@/pages/sprint-project';

export const Route = createFileRoute('/_app/_student/sprint/$projectId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(projectQuery(params.projectId)),
  component: function Page() {
    const { projectId } = Route.useParams();
    return <SprintProjectPage projectId={projectId} backTo={{ to: '/sprint', label: 'Проекты' }} />;
  },
});
