import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { skillsQuery } from '@/entities/skill';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export type SkillReq = { slug: string; required: boolean };

export function SkillsPicker({ value, onChange }: { value: SkillReq[]; onChange: (v: SkillReq[]) => void }) {
  const [open, setOpen] = useState(false);
  const skills = useQuery(skillsQuery);
  const titles = Object.fromEntries((skills.data ?? []).map((s) => [s.slug, s.title]));
  const have = new Set(value.map((s) => s.slug));

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((s) => (
        <span key={s.slug} className={cn('inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm', s.required ? 'border-primary/50' : 'border-dashed')}>
          {titles[s.slug] ?? s.slug}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-1.5 text-xs"
            onClick={() => onChange(value.map((x) => (x.slug === s.slug ? { ...x, required: !x.required } : x)))}
            title="Обязательный или желательный"
          >
            {s.required ? 'обязательно' : 'желательно'}
          </button>
          <button type="button" aria-label={`Убрать ${titles[s.slug] ?? s.slug}`} className="text-muted-foreground hover:text-foreground rounded-full p-1" onClick={() => onChange(value.filter((x) => x.slug !== s.slug))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="rounded-full" disabled={value.length >= 12}>
            <Plus />
            Навык
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Найти навык" />
            <CommandList>
              <CommandEmpty>Нет такого навыка</CommandEmpty>
              {skills.data
                ?.filter((s) => !have.has(s.slug))
                .map((s) => (
                  <CommandItem
                    key={s.slug}
                    value={s.title}
                    onSelect={() => {
                      onChange([...value, { slug: s.slug, required: true }]);
                      setOpen(false);
                    }}
                  >
                    {s.title}
                    <span className="text-muted-foreground ml-auto text-xs">{s.category}</span>
                  </CommandItem>
                ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
