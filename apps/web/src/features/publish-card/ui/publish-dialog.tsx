import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { draftKeys } from '@/entities/draft';
import { api, problemMessage, unwrap } from '@/shared/api';
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

export function PublishButton({ draftId, readiness, beforePublish }: { draftId: string; readiness: number; beforePublish: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/bcb/drafts/{id}/publish', { params: { path: { id: draftId } }, body: { confirm: true } })),
    onSuccess: async (r) => {
      toast.success('Задача опубликована', { description: `+${r.points} баллов компании за готовность ${r.readiness}%` });
      await queryClient.invalidateQueries({ queryKey: draftKeys.all });
    },
    onError: (e) => toast.error(problemMessage(e)),
  });

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
          <AlertDialogFooter>
            <AlertDialogCancel>Ещё поправлю</AlertDialogCancel>
            <AlertDialogAction onClick={() => publish.mutate()}>Да, опубликовать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
