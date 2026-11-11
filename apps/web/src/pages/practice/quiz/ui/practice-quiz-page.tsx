import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { practiceKeys, quizQuery } from '@/entities/practice';
import { api, problemMessage, unwrap, type Schemas } from '@/shared/api';
import { plural } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { FormError } from '@/shared/ui/field';

type Result = Schemas['PracticeQuizResult'];

export function PracticeQuizPage({ moduleId }: { moduleId: string }) {
  const quiz = useQuery(quizQuery(moduleId));
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const submit = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/api/practice/modules/{id}/quiz', { params: { path: { id: moduleId } }, body: { answers: Object.entries(answers).map(([questionId, option]) => ({ questionId, option })) } })),
    onSuccess: async (r) => {
      setResult(r);
      await queryClient.invalidateQueries({ queryKey: practiceKeys.all });
    },
  });

  if (quiz.isPending) return <Skeleton className="h-96 max-w-3xl" />;
  if (!quiz.data) return null;
  const shown = result ?? null;
  const verdict = new Map((shown?.perQuestion ?? []).map((q) => [q.questionId, q]));
  const total = quiz.data.questions.length;

  return (
    <div className="grid max-w-3xl gap-8">
      <Link to="/practice" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
        <ArrowLeft className="size-4" />
        Практика
      </Link>
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Тест модуля</h1>
        <p className="text-muted-foreground mt-1">
          {quiz.data.result && !shown ? `Прошлый результат: ${quiz.data.result.correct} из ${quiz.data.result.total}. Баллы дают только за первую попытку.` : `${total} ${plural(total, ['вопрос', 'вопроса', 'вопросов'])}. После ответа покажем разбор.`}
        </p>
      </header>

      <ol className="grid gap-8">
        {quiz.data.questions.map((q, i) => {
          const v = verdict.get(q.id);
          return (
            <li key={q.id}>
              <fieldset disabled={!!shown} className="grid gap-2">
                <legend className="mb-2 font-medium">
                  {i + 1}. {q.text}
                </legend>
                {q.options.map((o, k) => {
                  const picked = answers[q.id] === k;
                  const isRight = v && v.correct === k;
                  return (
                    <label
                      key={k}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors',
                        !v && (picked ? 'border-primary bg-accent' : 'hover:bg-muted/50'),
                        v && isRight && 'border-success bg-success-soft',
                        v && picked && !isRight && 'border-destructive bg-destructive/10',
                      )}
                    >
                      <input type="radio" name={q.id} className="accent-primary mt-0.5" checked={picked} onChange={() => setAnswers((a) => ({ ...a, [q.id]: k }))} />
                      {o}
                    </label>
                  );
                })}
                {v && <p className={cn('text-sm', v.ok ? 'text-success' : 'text-muted-foreground')}>{v.ok ? 'Верно. ' : 'Неверно. '}{v.explanation}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {shown ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <p>
            <span className="text-2xl font-semibold tabular-nums">
              {shown.correct} из {shown.total}
            </span>
            {shown.points > 0 && <span className="text-success ml-3 font-medium">+{shown.points} баллов</span>}
          </p>
          <Button asChild>
            <Link to="/practice">К заданиям</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 border-t pt-6">
          <FormError message={submit.isError ? problemMessage(submit.error) : undefined} />
          <Button className="w-fit" disabled={Object.keys(answers).length < total || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? 'Проверяем…' : 'Проверить ответы'}
          </Button>
        </div>
      )}
    </div>
  );
}
