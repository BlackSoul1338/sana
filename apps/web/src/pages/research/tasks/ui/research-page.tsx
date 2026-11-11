import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { researchKeys, researchTasksQuery, workspacesQuery } from '@/entities/research';
import { useActiveTeam, useMe } from '@/entities/viewer';
import { api, problemMessage, unwrap, type Schemas } from '@/shared/api';
import { RUBRIC_TITLE, WS_STATUS } from '@/shared/config';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { EmptyState, SectionTitle, Status } from '@/shared/ui/status';
import { Textarea } from '@/shared/ui/textarea';

function StartDialog({ task, teamId, children }: { task: Schemas['ResearchTask']; teamId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/research/tasks/{id}/workspaces', { params: { path: { id: task.id } }, body: { teamId, initialPosition: position } })),
    onSuccess: async (ws) => {
      await queryClient.invalidateQueries({ queryKey: researchKeys.all });
      void navigate({ to: '/research/$workspaceId', params: { workspaceId: ws.id } });
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>{task.question}</DialogDescription>
        </DialogHeader>
        <Field label="С чего начинаете" htmlFor="ws-pos" hint="Начальная позиция команды. В конце сравним её с выводом.">
          <Textarea id="ws-pos" rows={4} value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Что команда думает сейчас и почему" />
        </Field>
        <FormError message={start.isError ? problemMessage(start.error) : undefined} />
        <DialogFooter>
          <Button disabled={position.trim().length < 10 || start.isPending} onClick={() => start.mutate()}>
            Начать исследование
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [points, setPoints] = useState<Record<keyof typeof RUBRIC_TITLE, number>>({ argumentation: 20, completeness: 15, understanding: 15, originality: 10 });
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/research/tasks', {
          body: { title, question, context, rubric: (Object.keys(points) as (keyof typeof points)[]).map((key) => ({ key, maxPoints: points[key], description: '' })) },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: researchKeys.all });
      setOpen(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Новая исследовательская задача</DialogTitle>
          <DialogDescription>Команды отвечают на вопрос с опорой на источники. Вывод оценивается по рубрике.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Название" htmlFor="rt-title">
            <Input id="rt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Исследовательский вопрос" htmlFor="rt-q">
            <Textarea id="rt-q" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </Field>
          <Field label="Контекст" htmlFor="rt-c" hint="Необязательно: данные, ограничения">
            <Textarea id="rt-c" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Рубрика, максимум баллов</legend>
            {(Object.keys(RUBRIC_TITLE) as (keyof typeof RUBRIC_TITLE)[]).map((k) => (
              <label key={k} className="flex items-center justify-between gap-4 text-sm">
                {RUBRIC_TITLE[k]}
                <Input type="number" min={1} max={50} className="w-20" value={points[k]} onChange={(e) => setPoints((p) => ({ ...p, [k]: Number(e.target.value) }))} />
              </label>
            ))}
          </fieldset>
          <FormError message={create.isError ? problemMessage(create.error) : undefined} />
        </div>
        <DialogFooter>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            Опубликовать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResearchPage() {
  const me = useMe();
  const isTeacher = me.profile!.role === 'teacher';
  const { team } = useActiveTeam();
  const tasks = useQuery(researchTasksQuery);
  const workspaces = useQuery(workspacesQuery());
  const mine = new Map((workspaces.data ?? []).filter((w) => w.teamId === team?.id).map((w) => [w.taskId, w]));

  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Исследования</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            {isTeacher ? 'Задачи для командного исследования и работа команд над ними.' : 'Команда обсуждает гипотезы, собирает источники и формулирует вывод, где каждое утверждение опирается на доказательства.'}
          </p>
        </div>
        {isTeacher && (
          <NewTaskDialog>
            <Button>
              <Plus />
              Новая задача
            </Button>
          </NewTaskDialog>
        )}
      </header>

      {isTeacher && (
        <section>
          <SectionTitle>Работа команд</SectionTitle>
          {workspaces.isPending ? (
            <Skeleton className="h-32" />
          ) : workspaces.data?.length === 0 ? (
            <p className="text-muted-foreground text-sm">Команды ещё не начали ни одного исследования.</p>
          ) : (
            <ul className="bg-card divide-y rounded-lg border">
              {workspaces.data?.map((w) => (
                <li key={w.id}>
                  <Link to="/research/$workspaceId" params={{ workspaceId: w.id }} className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 transition-colors">
                    <span className="min-w-0">
                      <span className="block font-medium">{w.teamName}</span>
                      <span className="text-muted-foreground text-sm">{w.taskTitle}</span>
                    </span>
                    <Status tone={WS_STATUS[w.status].tone}>{WS_STATUS[w.status].label}</Status>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!isTeacher && mine.size > 0 && (
        <section>
          <SectionTitle>Исследования команды</SectionTitle>
          <ul className="bg-card divide-y rounded-lg border">
            {[...mine.values()].map((w) => (
              <li key={w.id}>
                <Link to="/research/$workspaceId" params={{ workspaceId: w.id }} className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 transition-colors">
                  <span className="font-medium">{w.taskTitle}</span>
                  <Status tone={WS_STATUS[w.status].tone}>{WS_STATUS[w.status].label}</Status>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>{isTeacher || mine.size === 0 ? 'Задачи' : 'Другие задачи'}</SectionTitle>
        {tasks.isPending ? (
          <Skeleton className="h-48" />
        ) : tasks.data?.length === 0 ? (
          <EmptyState title="Задач пока нет" text={isTeacher ? 'Опубликуйте первую — команды увидят её здесь.' : 'Преподаватель ещё не опубликовал задачи.'} />
        ) : (
          <ul className="grid gap-6">
            {tasks.data
              ?.filter((t) => isTeacher || !mine.has(t.id))
              .map((t) => {
              const ws = mine.get(t.id);
              return (
                <li key={t.id} className="grid gap-2 border-b pb-6 last:border-none">
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="max-w-prose">{t.question}</p>
                  {t.context && <p className="text-muted-foreground max-w-prose text-sm">{t.context}</p>}
                  {!isTeacher && (
                    <div className="mt-1">
                      {ws ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/research/$workspaceId" params={{ workspaceId: ws.id }}>
                            Открыть исследование
                          </Link>
                        </Button>
                      ) : team ? (
                        <StartDialog task={t} teamId={team.id}>
                          <Button size="sm" variant="outline">
                            Начать с командой {team.name}
                          </Button>
                        </StartDialog>
                      ) : (
                        <p className="text-muted-foreground text-sm">Исследование ведёт команда — создайте её в разделе «Команда».</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
