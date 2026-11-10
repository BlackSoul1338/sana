import { Circle, CircleCheck, CircleDot, Clock, Plus } from 'lucide-react';
import { AddTaskDialog } from '@/features/add-sprint-task';
import { SubmitEvidenceDialog } from '@/features/submit-evidence';
import { AssigneeSelect, StartTaskToggle } from '@/features/update-sprint-task';
import type { Project, SprintTask } from '@/entities/project';
import type { Team } from '@/entities/team';
import { STAGE_ORDER, STAGE_TITLES, TASK_STATUS } from '@/shared/config';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

const ICON = { todo: Circle, in_progress: CircleDot, submitted: Clock, done: CircleCheck } as const;

function TaskRow({
  task,
  project,
  team,
  editable,
  canSubmit,
}: {
  task: SprintTask;
  project: Project;
  team: Team | undefined;
  editable: boolean;
  canSubmit: boolean;
}) {
  const Icon = ICON[task.status];
  const open = task.status === 'todo' || task.status === 'in_progress';
  return (
    <li className="group flex items-center gap-3 py-2.5">
      <Icon
        aria-label={TASK_STATUS[task.status]}
        className={cn(
          'size-4 shrink-0',
          task.status === 'done' && 'text-success',
          task.status === 'in_progress' && 'text-primary',
          task.status === 'submitted' && 'text-warning',
          task.status === 'todo' && 'text-muted-foreground',
        )}
      />
      <span className={cn('min-w-0 flex-1 truncate text-sm', task.status === 'done' && 'text-muted-foreground line-through')}>
        {task.title}
      </span>
      <AssigneeSelect task={task} team={team} disabled={!editable || !open} />
      {editable && open && (
        <div className="flex items-center gap-3 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <StartTaskToggle task={task} />
          {canSubmit && (
            <SubmitEvidenceDialog project={project} defaultTarget="task" defaultTaskId={task.id}>
              <Button variant="outline" size="xs">
                Сдать
              </Button>
            </SubmitEvidenceDialog>
          )}
        </div>
      )}
      {task.status === 'submitted' && <span className="text-muted-foreground text-xs">на проверке</span>}
    </li>
  );
}

/** editable: plan tasks (members and mentors); canSubmit: hand in results (student members only). */
export function TaskBoard({
  project,
  team,
  editable,
  canSubmit,
}: {
  project: Project;
  team: Team | undefined;
  editable: boolean;
  canSubmit: boolean;
}) {
  const current = project.stages.find((s) => s.isCurrent)?.key;
  const groups = STAGE_ORDER.map((key) => ({ key, tasks: project.tasks.filter((t) => t.stageKey === key) })).filter(
    (g) => g.tasks.length > 0 || g.key === current,
  );

  return (
    <div className="grid gap-6">
      {groups.map(({ key, tasks }) => (
        <section key={key}>
          <div className="flex items-center gap-2">
            <h3 className={cn('text-sm font-medium', key !== current && 'text-muted-foreground')}>{STAGE_TITLES[key]}</h3>
            <span className="text-muted-foreground text-xs">
              {tasks.filter((t) => t.status === 'done').length}/{tasks.length}
            </span>
            {editable && key === current && (
              <AddTaskDialog project={project} team={team} stageKey={key}>
                <Button variant="ghost" size="xs" className="ml-auto">
                  <Plus />
                  Задача
                </Button>
              </AddTaskDialog>
            )}
          </div>
          {tasks.length > 0 ? (
            <ul className="divide-y">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} project={project} team={team} editable={editable} canSubmit={canSubmit} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-3 text-sm">Задач пока нет — добавьте первую, чтобы распределить работу.</p>
          )}
        </section>
      ))}
    </div>
  );
}
