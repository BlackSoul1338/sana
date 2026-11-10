import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { signOut } from '@/features/auth';
import { ROLE_LABEL, useMe } from '@/entities/viewer';
import { useTheme, type Theme } from '@/shared/lib/theme-context';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'system', label: 'Как в системе', icon: Monitor },
];

export function UserMenu() {
  const me = useMe();
  const { theme, setTheme } = useTheme();
  const profile = me.profile!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Меню профиля">
          <span className="bg-accent text-accent-foreground grid size-8 place-items-center rounded-full text-sm font-medium">
            {profile.displayName.slice(0, 1).toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="font-medium">{profile.displayName}</div>
          <div className="text-muted-foreground text-xs">
            {ROLE_LABEL[profile.role]} · {me.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="text-muted-foreground" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
