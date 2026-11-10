import { createFileRoute } from '@tanstack/react-router';
import { BuilderNewPage } from '@/pages/builder-new';

export const Route = createFileRoute('/_app/_business/builder/new')({
  component: BuilderNewPage,
});
