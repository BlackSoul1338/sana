import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { dashboardQuery, modulesQuery } from '@/entities/practice';
import { Button } from '@/shared/ui/button';
import { Segmented } from '@/shared/ui/segmented';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, SectionTitle, Status } from '@/shared/ui/status';
import { NewAssignmentDialog } from './new-assignment-dialog';

const CELL = {
  checked: { label: 'черновик', tone: 'neutral' },
  sent: { label: 'ждёт', tone: 'warning' },
  approved: { label: 'принято', tone: 'success' },
  rejected: { label: 'доработка', tone: 'danger' },
} as const;

/** Teacher: per module — assignments, where students struggle, and who needs a decision. */
export function PracticeTeacherPage() {
  const modules = useQuery(modulesQuery);
  const [picked, setPicked] = useState<string | null>(null);
  const moduleId = picked ?? modules.data?.[0]?.id ?? '';
  const mod = modules.data?.find((m) => m.id === moduleId);
  const dash = useQuery({ ...dashboardQuery(moduleId), enabled: !!moduleId });

  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Практика</h1>
          <p className="text-muted-foreground mt-1">Задания модуля, результаты студентов и темы, где чаще ошибаются.</p>
        </div>
        {mod && (
          <NewAssignmentDialog module={mod}>
            <Button>
              <Plus />
              Новое задание
            </Button>
          </NewAssignmentDialog>
        )}
      </header>

      {modules.data && (
        <div className="-mx-4 overflow-x-auto px-4">
          <Segmented label="Модуль" value={moduleId} onChange={setPicked} options={modules.data.map((m) => ({ value: m.id, label: m.title }))} />
        </div>
      )}

      {dash.isPending ? (
        <Skeleton className="h-64" />
      ) : !dash.data ? null : (
        <>
          <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
            <section>
              <SectionTitle>Задания</SectionTitle>
              {dash.data.assignments.length === 0 ? (
                <EmptyState title="В модуле пока нет заданий" text="Создайте первое — студенты увидят его после теста модуля." />
              ) : (
                <ul className="bg-card divide-y rounded-lg border">
                  {dash.data.assignments.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3">
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground text-sm tabular-nums">
                        {a.approved} из {a.students} принято, в среднем {a.avgAttempts} попытки
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <SectionTitle>Проблемные темы</SectionTitle>
              {dash.data.problemTopics.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ошибок пока нет.</p>
              ) : (
                <ul className="grid gap-3">
                  {dash.data.problemTopics.map((t) => (
                    <li key={t.topic} className="grid gap-1 text-sm">
                      <div className="flex justify-between gap-4">
                        <span>{t.topic}</span>
                        <span className="text-muted-foreground tabular-nums">{Math.round(t.share * 100)}%</span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div className="bg-warning h-full rounded-full" style={{ width: `${Math.round(t.share * 100)}%` }} />
                      </div>
                      <span className="text-muted-foreground text-xs">
                        ошибок в тесте {t.quizWrong}, недовыполненных критериев {t.criteriaMissed}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <SectionTitle>Студенты</SectionTitle>
            {dash.data.students.length === 0 ? (
              <p className="text-muted-foreground text-sm">Модуль ещё никто не начал.</p>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4">
                <table className="w-full min-w-xl text-sm">
                  <thead className="text-muted-foreground text-left">
                    <tr className="border-b">
                      <th className="py-2 pr-4 font-normal">Студент</th>
                      <th className="py-2 pr-4 font-normal">Тест</th>
                      {dash.data.assignments.map((a) => (
                        <th key={a.id} className="max-w-40 py-2 pr-4 font-normal" title={a.title}>
                          <span className="line-clamp-2">{a.title}</span>
                        </th>
                      ))}
                      <th className="py-2 text-right font-normal">Баллы</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dash.data.students.map((s) => (
                      <tr key={s.profileId}>
                        <td className="py-2.5 pr-4 whitespace-nowrap">{s.name}</td>
                        <td className="text-muted-foreground py-2.5 pr-4 tabular-nums">{s.quiz ? `${s.quiz.correct}/${s.quiz.total}` : '—'}</td>
                        {dash.data.assignments.map((a) => {
                          const c = s.cells.find((x) => x.assignmentId === a.id);
                          return (
                            <td key={a.id} className="py-2.5 pr-4">
                              {!c ? (
                                <span className="text-muted-foreground">—</span>
                              ) : c.status === 'sent' ? (
                                <Link to="/review" className="text-primary text-xs font-medium">
                                  проверить
                                </Link>
                              ) : (
                                <Status tone={CELL[c.status].tone}>
                                  {CELL[c.status].label}
                                  {c.attempts > 1 ? `, ${c.attempts} поп.` : ''}
                                </Status>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 text-right font-medium tabular-nums">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
