import { createFileRoute } from '@tanstack/react-router';
import { BuilderDraftsPage } from '@/pages/builder-drafts';

export const Route = createFileRoute('/_app/_business/builder/')({
  component: BuilderDraftsPage,
});
