import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { projectKeys } from '@/entities/project';
import { ApiProblem, api, problemMessage, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Segmented } from '@/shared/ui/segmented';
import { Textarea } from '@/shared/ui/textarea';

export function FeedbackPopover({ evidenceId }: { evidenceId: string }) {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<'positive' | 'needs_work'>('positive');
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/match/feedback', { body: { evidenceId, verdict, comment: comment.trim() } })),
    onSuccess: async (r) => {
      setOpen(false);
      setDone(true);
      toast.success('Спасибо за отзыв', { description: r.bonusPoints > 0 ? `Команда получила +${r.bonusPoints} за реальную задачу` : undefined });
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
    onError: (e) => {
      if (e instanceof ApiProblem && e.status === 409) {
        setDone(true);
        setOpen(false);
      }
      toast.error(problemMessage(e));
    },
  });

  if (done) return <span className="text-muted-foreground text-xs">отзыв оставлен</span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <ThumbsUp />
          Оценить
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid w-80 gap-3" align="end">
        <p className="text-sm font-medium">Как вам результат?</p>
        <Segmented
          label="Оценка"
          value={verdict}
          onChange={setVerdict}
          options={[
            { value: 'positive', label: 'Полезно' },
            { value: 'needs_work', label: 'Нужно доработать' },
          ]}
        />
        <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий для команды" />
        <Button size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
          Отправить
        </Button>
      </PopoverContent>
    </Popover>
  );
}
