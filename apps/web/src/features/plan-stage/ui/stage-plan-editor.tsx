import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectKeys, type Project } from '@/entities/project';
import { api, problemMessage, unwrap } from '@/shared/api';
import { STAGE_TITLES } from '@/shared/config';
import { Input } from '@/shared/ui/input';

export function StagePlanEditor({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: async ({ stageKey, plannedAt }: { stageKey: Project['stages'][number]['key']; plannedAt: string }) =>
      unwrap(
        await api.PATCH('/api/sprint/projects/{id}/stages/{stageKey}', {
          params: { path: { id: project.id, stageKey } },
          body: { plannedAt },
        }),
      ),
    onSuccess: (p) => {
      queryClient.setQueryData(projectKeys.detail(project.id), p);
      toast.success('Срок обновлён');
    },
    onError: (e) => toast.error(problemMessage(e)),
  });

  return (
    <ul className="grid gap-2">
      {project.stages.map((s) => (
        <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
          <span className={s.status === 'approved' ? 'text-muted-foreground' : ''}>{STAGE_TITLES[s.key]}</span>
          <Input
            type="date"
            className="h-8 w-36 shrink-0"
            defaultValue={s.plannedAt}
            disabled={s.status === 'approved'}
            aria-label={`Плановая дата: ${STAGE_TITLES[s.key]}`}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== s.plannedAt) update.mutate({ stageKey: s.key, plannedAt: e.target.value });
            }}
          />
        </li>
      ))}
    </ul>
  );
}
