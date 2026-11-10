import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { projectKeys, templatesQuery, type Project } from '@/entities/project';
import type { Team } from '@/entities/team';
import { api, problemMessage, unwrap } from '@/shared/api';
import { STAGE_TITLES, type StageKey } from '@/shared/config';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

const NOBODY = '__nobody';

export function AddTaskDialog({ project, team, stageKey, children }: { project: Project; team: Team | undefined; stageKey: StageKey; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>(NOBODY);
  const queryClient = useQueryClient();
  const templates = useQuery({ ...templatesQuery, enabled: open });
  const used = new Set(project.tasks.map((t) => t.templateSlug));
  const options = (templates.data ?? []).filter((t) => t.stageKey === stageKey && !used.has(t.slug));

  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST('/api/sprint/projects/{id}/tasks', {
          params: { path: { id: project.id } },
          body: templateSlug
            ? { templateSlug, assigneeId: assigneeId === NOBODY ? null : assigneeId }
            : { title: title.trim(), stageKey, assigneeId: assigneeId === NOBODY ? null : assigneeId },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
      setOpen(false);
      setTemplateSlug(null);
      setTitle('');
    },
  });

  const ready = !!templateSlug || title.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Задача на этап «{STAGE_TITLES[stageKey]}»</DialogTitle>
          <DialogDescription>Возьмите готовую или опишите свою.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {options.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => {
                setTemplateSlug(t.slug === templateSlug ? null : t.slug);
                setTitle('');
              }}
              className={cn(
                'rounded-md border px-3 py-2.5 text-left transition-colors',
                templateSlug === t.slug ? 'border-primary bg-accent' : 'hover:bg-muted',
              )}
            >
              <div className="text-sm font-medium">{t.title}</div>
              <div className="text-muted-foreground line-clamp-2 text-xs">{t.description}</div>
            </button>
          ))}
          <Input
            placeholder="Или своя задача…"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTemplateSlug(null);
            }}
          />
        </div>
        {team && (
          <Field label="Кто делает">
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOBODY}>Пока никто</SelectItem>
                {team.members.map((m) => (
                  <SelectItem key={m.profileId} value={m.profileId}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <FormError message={add.error ? problemMessage(add.error) : undefined} />
        <DialogFooter>
          <Button disabled={!ready || add.isPending} onClick={() => add.mutate()}>
            <Plus />
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
