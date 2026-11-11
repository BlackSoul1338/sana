import { createFileRoute } from '@tanstack/react-router';
import { ResearchWorkspacePage } from '@/pages/research/workspace';

export const Route = createFileRoute('/_app/research/$workspaceId')({
  component: function Page() {
    return <ResearchWorkspacePage workspaceId={Route.useParams().workspaceId} />;
  },
});
