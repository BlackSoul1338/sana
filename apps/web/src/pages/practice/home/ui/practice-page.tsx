import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { assignmentsQuery, modulesQuery, recommendationQuery } from '@/entities/practice';
import { DIFFICULTY } from '@/shared/config';
import { Skeleton } from '@/shared/ui/skeleton';
import { SectionTitle, Status } from '@/shared/ui/status';

const STATUS = {
  checked: { label: 'проверено моделью', tone: 'neutral' },
  sent: { label: 'у преподавателя', tone: 'warning' },
  approved: { label: 'принято', tone: 'success' },
  rejected: { label: 'на доработку', tone: 'danger' },
} as const;

/** Student: modules in order; each opens with its test, then the assignments. */
export function PracticePage() {
  const modules = useQuery(modulesQuery);
  const assignments = useQuery(assignmentsQuery());
  const next = useQuery(recommendationQuery).data;

  return (
    <div className="grid max-w-3xl gap-10">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Практика</h1>
        <p className="text-muted-foreground mt-1">Короткий тест открывает задания модуля. Модель проверяет работу по критериям, баллы подтверждает преподаватель.</p>
      </header>

      {next && (
        <Link to="/practice/assignments/$assignmentId" params={{ assignmentId: next.assignmentId }} className="bg-accent hover:bg-accent/80 grid gap-1 rounded-lg p-4 transition-colors">
          <span className="text-accent-foreground text-sm font-medium">Следующее задание</span>
          <span className="font-medium">{next.title}</span>
          <span className="text-muted-foreground text-sm">{next.reason}</span>
        </Link>
      )}

      {modules.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        modules.data?.map((m) => {
          const items = (assignments.data ?? []).filter((a) => a.moduleId === m.id);
          return (
            <section key={m.id}>
              <SectionTitle
                aside={
                  <Link to="/practice/modules/$moduleId/quiz" params={{ moduleId: m.id }} className="text-primary text-sm whitespace-nowrap">
                    {m.quiz ? `Тест: ${m.quiz.correct} из ${m.quiz.total}` : 'Пройти тест'}
                  </Link>
                }
              >
                {m.title}
              </SectionTitle>
              <p className="text-muted-foreground -mt-1 mb-3 text-sm">{m.description}</p>
              {!m.quiz ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm">
                  {items.length} {items.length === 1 ? 'задание' : 'заданий'} откроются после теста — пять вопросов, около пяти минут.
                </p>
              ) : (
                <ul className="bg-card divide-y rounded-lg border">
                  {items.map((a) => (
                    <li key={a.id}>
                      <Link to="/practice/assignments/$assignmentId" params={{ assignmentId: a.id }} className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 transition-colors">
                        <span className="min-w-0">
                          <span className="block font-medium">{a.title}</span>
                          <span className="text-muted-foreground text-sm">{DIFFICULTY[a.difficulty as 1 | 2 | 3]} уровень</span>
                        </span>
                        {a.myStatus && <Status tone={STATUS[a.myStatus].tone}>{STATUS[a.myStatus].label}</Status>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
