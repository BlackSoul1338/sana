import { createFileRoute } from '@tanstack/react-router';
import { projectQuery } from '@/entities/project';
import { SprintProjectPage } from '@/pages/sprint-project';
import { guard } from '../../../guard';

export const Route = createFileRoute('/_app/projects/$projectId')({
  beforeLoad: ({ context }) => guard(context.queryClient, ['mentor', 'business']),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(projectQuery(params.projectId)),
  component: function Page() {
    const { projectId } = Route.useParams();
    const { me } = Route.useRouteContext();
    const back = me.profile?.role === 'business' ? { to: '/tasks', label: 'Мои задачи' } : { to: '/projects', label: 'Проекты' };
    return <SprintProjectPage projectId={projectId} backTo={back} />;
  },
});
