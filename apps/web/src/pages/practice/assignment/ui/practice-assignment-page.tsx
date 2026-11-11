import { practice } from '@sana/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ReturnNote } from '@/entities/evidence';
import { assignmentsQuery, attemptsQuery, CheckResult, practiceKeys, type PracticeAttempt } from '@/entities/practice';
import { api, problemMessage, unwrap } from '@/shared/api';
import { DIFFICULTY } from '@/shared/config';
import { formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { FormError } from '@/shared/ui/field';
import { Skeleton } from '@/shared/ui/skeleton';
import { SectionTitle } from '@/shared/ui/status';
import { Textarea } from '@/shared/ui/textarea';

const STATUS_TEXT: Record<PracticeAttempt['status'], string> = {
  checked: 'Проверено моделью. Исправьте и проверьте снова или отправьте преподавателю.',
  sent: 'Работа у преподавателя. Баллы появятся после его решения.',
  approved: 'Преподаватель принял работу.',
  rejected: 'Преподаватель вернул работу на доработку — отправьте новую попытку.',
};

export function PracticeAssignmentPage({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const assignment = useQuery({ ...assignmentsQuery(), select: (list) => list.find((a) => a.id === assignmentId) });
  const attempts = useQuery(attemptsQuery(assignmentId));
  const [draft, setDraft] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: practiceKeys.all });
  const check = useMutation({
    mutationFn: async (answer: string) => unwrap(await api.POST('/api/practice/assignments/{id}/attempts', { params: { path: { id: assignmentId } }, body: { answer } })),
    onSuccess: async (a) => {
      setFreshId(a.id);
      setDraft(null);
      await refresh();
    },
  });
  const send = useMutation({
    mutationFn: async (id: string) => unwrap(await api.POST('/api/practice/attempts/{id}/send', { params: { path: { id } } })),
    onSuccess: async () => {
      toast.success('Отправлено преподавателю');
      await refresh();
    },
  });

  if (assignment.isPending || attempts.isPending) return <Skeleton className="h-96 max-w-3xl" />;
  const a = assignment.data;
  if (!a) return <p className="text-muted-foreground">Задание не найдено.</p>;
  const list = attempts.data ?? [];
  const last = list.at(-1);
  const locked = last?.status === 'sent' || last?.status === 'approved';
  const returned = locked ? undefined : list.findLast((t) => t.status === 'rejected');
  const canCheck = list.length < practice.MAX_ATTEMPTS || last?.status === 'rejected';
  const answer = draft ?? last?.answer ?? '';

  return (
    <div className="grid max-w-3xl gap-10">
      <Link to="/practice" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Практика
      </Link>
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{a.title}</h1>
        <p className="text-muted-foreground mt-1">Сложность: {DIFFICULTY[a.difficulty as 1 | 2 | 3].toLowerCase()}</p>
      </header>

      <section className="grid gap-3">
        <p className="max-w-prose whitespace-pre-line">{a.condition}</p>
        {a.materials && <p className="text-muted-foreground max-w-prose text-sm whitespace-pre-line">{a.materials}</p>}
      </section>

      <section>
        <SectionTitle>По каким критериям проверяем</SectionTitle>
        <ul className="grid gap-2">
          {a.criteria.map((c) => (
            <li key={c.id} className="flex justify-between gap-4 text-sm">
              <span>
                <span className="font-medium">{c.title}.</span> <span className="text-muted-foreground">{c.description}</span>
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">до {c.maxPoints}</span>
            </li>
          ))}
        </ul>
      </section>

      {last && (
        <section>
          <SectionTitle aside={<span className="text-muted-foreground text-sm">попытка {last.attemptNo}</span>}>Проверка</SectionTitle>
          <p className="text-muted-foreground mb-4 text-sm">{STATUS_TEXT[last.status]}</p>
          <CheckResult criteria={a.criteria} check={last.check} corrected={last.corrected} reveal={last.id === freshId} />
          {last.check && (
            <p className="text-muted-foreground mt-4 text-sm">
              Предварительно: {last.preview.correctness + last.preview.completeness + last.preview.selfCorrection + last.preview.completion} баллов. Итог подтвердит преподаватель.
            </p>
          )}
        </section>
      )}

      {!locked && (
        <section className="grid gap-3">
          <SectionTitle aside={last && list.length < practice.MAX_ATTEMPTS && <span className="text-muted-foreground text-sm">осталось проверок: {practice.MAX_ATTEMPTS - list.length}</span>}>
            {last ? 'Исправленный ответ' : 'Ваш ответ'}
          </SectionTitle>
          {returned?.evidenceId && <ReturnNote evidenceId={returned.evidenceId}>Комментарий преподавателя к возвращённой работе:</ReturnNote>}
          {!canCheck && <p className="text-muted-foreground text-sm">Проверки закончились — отправьте последнюю попытку преподавателю.</p>}
          <Textarea rows={10} readOnly={!canCheck} value={answer} onChange={(e) => setDraft(e.target.value)} placeholder="Опишите решение по шагам, приложите ключевой код." aria-label="Ответ" />
          <FormError message={check.isError ? problemMessage(check.error) : send.isError ? problemMessage(send.error) : undefined} />
          <div className="flex flex-wrap gap-3">
            {canCheck && (
              <Button disabled={answer.trim().length < 20 || check.isPending || (draft === null && !!last)} onClick={() => check.mutate(answer)}>
                {check.isPending ? 'Проверяем…' : 'Проверить'}
              </Button>
            )}
            {last?.status === 'checked' && (
              <Button variant="outline" disabled={send.isPending || draft !== null} onClick={() => send.mutate(last.id)}>
                Отправить преподавателю
              </Button>
            )}
          </div>
        </section>
      )}

      {list.length > 1 && (
        <section>
          <SectionTitle>Попытки</SectionTitle>
          <ol className="grid gap-2 text-sm">
            {[...list].reverse().map((t) => (
              <li key={t.id} className="flex flex-wrap justify-between gap-x-4">
                <span>
                  Попытка {t.attemptNo}
                  {t.corrected.length > 0 && <span className="text-success ml-2">исправлено критериев: {t.corrected.length}</span>}
                </span>
                <span className="text-muted-foreground">{formatRelative(t.createdAt)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
