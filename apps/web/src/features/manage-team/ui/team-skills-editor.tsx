import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { skillsQuery } from '@/entities/skill';
import type { Team } from '@/entities/team';
import { api, unwrap } from '@/shared/api';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { useTeamMutation } from '../api/use-team-mutation';

type TeamSkill = Team['skills'][number];
const LEVELS = ['новичок', 'уверенно', 'опытно'];

export function TeamSkillsEditor({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const skills = useQuery(skillsQuery);
  const titles = Object.fromEntries((skills.data ?? []).map((s) => [s.slug, s.title]));
  const save = useTeamMutation(team.id, async (next: TeamSkill[]) =>
    unwrap(await api.PUT('/api/teams/{id}/skills', { params: { path: { id: team.id } }, body: { skills: next } })),
  );
  const current = save.isPending && save.variables ? save.variables : team.skills;
  const have = new Set(current.map((s) => s.slug));
  const categories = Object.groupBy(
    (skills.data ?? []).filter((s) => !have.has(s.slug)),
    (s) => s.category,
  );

  const cycleLevel = (slug: string) =>
    save.mutate(current.map((s) => (s.slug === slug ? { ...s, level: (s.level % 3) + 1 } : s)));

  return (
    <div className="flex flex-wrap gap-2">
      {current.map((s) => (
        <span key={s.slug} className="bg-muted inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm">
          {titles[s.slug] ?? s.slug}
          <button
            type="button"
            onClick={() => cycleLevel(s.slug)}
            title="Сменить уровень"
            className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1.5"
          >
            {[1, 2, 3].map((l) => (
              <span key={l} className={cn('size-1.5 rounded-full', l <= s.level ? 'bg-primary' : 'bg-border')} />
            ))}
            <span className="sr-only">{LEVELS[s.level - 1]}</span>
          </button>
          <button
            type="button"
            aria-label={`Убрать ${titles[s.slug] ?? s.slug}`}
            onClick={() => save.mutate(current.filter((x) => x.slug !== s.slug))}
            className="text-muted-foreground hover:text-foreground rounded-full p-1"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="rounded-full">
            <Plus />
            Навык
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Python, Figma, SQL…" />
            <CommandList>
              <CommandEmpty>Нет такого навыка</CommandEmpty>
              {Object.entries(categories).map(([category, list]) => (
                <CommandGroup key={category} heading={category}>
                  {list?.map((s) => (
                    <CommandItem
                      key={s.slug}
                      value={s.title}
                      onSelect={() => {
                        save.mutate([...current, { slug: s.slug, level: 1 }]);
                        setOpen(false);
                      }}
                    >
                      {s.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
