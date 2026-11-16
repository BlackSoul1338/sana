import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { draftKeys } from '@/entities/draft';
import { skillsQuery } from '@/entities/skill';
import { api, problemMessage, unwrap } from '@/shared/api';
import type { Schemas } from '@/shared/api';
import { DIFFICULTY } from '@/shared/config';
import { plural, signed } from '@/shared/lib/format';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';

export type PublishRequirements = NonNullable<Schemas['Draft']['requirements']>;

export function PublishButton({
  draftId,
  readiness,
  requirements,
  beforePublish,
}: {
  draftId: string;
  readiness: number;
  requirements?: PublishRequirements;
  beforePublish: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const skills = useQuery(skillsQuery);
  const publish = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/bcb/drafts/{id}/publish', {
          params: { path: { id: draftId } },
          body: { confirm: true, requirementsConfirmed: true },
        }),
      ),
    onSuccess: async (r) => {
      toast.success('Задача опубликована', { description: `${signed(r.points)} ${plural(r.points, ['балл', 'балла', 'баллов'])} компании за готовность ${r.readiness}%` });
      await queryClient.invalidateQueries({ queryKey: draftKeys.all });
    },
    onError: (e) => toast.error(problemMessage(e)),
  });
  const titles = Object.fromEntries((skills.data ?? []).map((s) => [s.slug, s.title]));

  return (
    <>
      <Button
        disabled={publish.isPending}
        onClick={async () => {
          if (await beforePublish()) setOpen(true);
        }}
      >
        <Send />
        Опубликовать
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Опубликовать задачу?</AlertDialogTitle>
            <AlertDialogDescription>
              Студенческие команды увидят её в каталоге и смогут откликнуться. Готовность {readiness}% — столько баллов получит компания. После
              публикации карточку не изменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requirements && (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Тема</dt>
                <dd className="text-right">{requirements.topic}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Сложность</dt>
                <dd className="text-right">{DIFFICULTY[requirements.difficulty as 1 | 2 | 3]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Оценка времени</dt>
                <dd className="text-right">~{requirements.estHours} ч</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Навыки</dt>
                <dd className="text-right">
                  {requirements.skills.map((s) => titles[s.slug] ?? s.slug).join(', ')}
                </dd>
              </div>
            </dl>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Ещё поправлю</AlertDialogCancel>
            <AlertDialogAction onClick={() => publish.mutate()}>Да, опубликовать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
