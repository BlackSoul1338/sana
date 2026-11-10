import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectKeys, type SprintTask } from '@/entities/project';
import type { Team } from '@/entities/team';
import { api, problemMessage, unwrap } from '@/shared/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

const NOBODY = '__nobody';

function useUpdateTask(task: SprintTask) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { assigneeId?: string | null; status?: 'todo' | 'in_progress' }) =>
      unwrap(await api.PATCH('/api/sprint/tasks/{id}', { params: { path: { id: task.id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(task.projectId) }),
    onError: (e) => toast.error(problemMessage(e)),
  });
}

export function AssigneeSelect({ task, team, disabled }: { task: SprintTask; team: Team | undefined; disabled?: boolean }) {
  const update = useUpdateTask(task);
  if (!team) return null;
  const name = team.members.find((m) => m.profileId === task.assigneeId)?.displayName;
  if (disabled) return <span className="text-muted-foreground text-xs">{name ?? 'без исполнителя'}</span>;
  return (
    <Select value={task.assigneeId ?? NOBODY} onValueChange={(v) => update.mutate({ assigneeId: v === NOBODY ? null : v })}>
      <SelectTrigger size="sm" className="text-muted-foreground h-7 border-none px-2 text-xs shadow-none" aria-label="Исполнитель">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOBODY}>без исполнителя</SelectItem>
        {team.members.map((m) => (
          <SelectItem key={m.profileId} value={m.profileId}>
            {m.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StartTaskToggle({ task }: { task: SprintTask }) {
  const update = useUpdateTask(task);
  if (task.status !== 'todo' && task.status !== 'in_progress') return null;
  const next = task.status === 'todo' ? 'in_progress' : 'todo';
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
      disabled={update.isPending}
      onClick={() => update.mutate({ status: next })}
    >
      {task.status === 'todo' ? 'Взять в работу' : 'Вернуть в очередь'}
    </button>
  );
}
