import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { Team } from '@/entities/team';
import { api, unwrap } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { useTeamMutation } from '../api/use-team-mutation';

export function AddMemberPopover({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const students = useQuery({
    queryKey: ['students', query],
    queryFn: async () => unwrap(await api.GET('/api/students', { params: { query: { q: query } } })),
    enabled: open,
  });
  const memberIds = new Set(team.members.map((m) => m.profileId));
  const add = useTeamMutation(
    team.id,
    async (profileId: string) => unwrap(await api.POST('/api/teams/{id}/members', { params: { path: { id: team.id } }, body: { profileId, roleSlug: null } })),
    'Участник добавлен',
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus />
          Добавить
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Имя студента" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>{students.isPending ? 'Ищем…' : 'Никого не нашли'}</CommandEmpty>
            {students.data
              ?.filter((s) => !memberIds.has(s.id))
              .map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => {
                    add.mutate(s.id);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  {s.displayName}
                </CommandItem>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
