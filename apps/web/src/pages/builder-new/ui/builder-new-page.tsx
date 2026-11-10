import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { StartDraftForm } from '@/features/challenge-dialog';

export function BuilderNewPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto grid max-w-2xl gap-8">
      <Link to="/builder" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Черновики
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">Что хотите решить?</h1>
        <p className="text-muted-foreground mt-2">
          Пара предложений о проблеме. Без персональных данных клиентов и сотрудников — их нельзя публиковать.
        </p>
      </header>
      <StartDraftForm onStarted={(id) => void navigate({ to: '/builder/$draftId', params: { draftId: id } })} />
    </div>
  );
}
