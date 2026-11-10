import { Link } from '@tanstack/react-router';
import { Check, ChevronsUpDown, Users } from 'lucide-react';
import { useActiveTeam } from '@/entities/viewer';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

export function TeamSwitcher() {
  const { team, teams, setActiveTeam } = useActiveTeam();

  if (!team) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/team">Создать команду</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-48">
          <Users className="text-muted-foreground" />
          <span className="truncate">{team.name}</span>
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {teams.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => setActiveTeam(t.id)}>
            <span className="truncate">{t.name}</span>
            {t.id === team.id && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/team">Управлять командой</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
