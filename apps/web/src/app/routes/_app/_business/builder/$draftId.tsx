import { createFileRoute } from '@tanstack/react-router';
import { draftQuery } from '@/entities/draft';
import { BuilderDraftPage } from '@/pages/builder-draft';

export const Route = createFileRoute('/_app/_business/builder/$draftId')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(draftQuery(params.draftId)),
  component: function Page() {
    const { draftId } = Route.useParams();
    return <BuilderDraftPage draftId={draftId} />;
  },
});
