import { Link, useRouterState } from '@tanstack/react-router';
import { Check, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { signOut } from '@/features/auth';
import { ROLE_LABEL, useActiveTeam, useMe } from '@/entities/viewer';
import { useTheme } from '@/shared/lib/theme-context';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/ui/sheet';
import { isActive, NAV } from './nav';
import { THEMES } from './themes';

/** Narrow screens: everything the header holds on desktop, in one sheet. */
export function MobileMenu() {
  const me = useMe();
  const profile = me.profile!;
  const { team, teams, setActiveTeam } = useActiveTeam();
  const { theme, setTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Меню">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-xs gap-0 overflow-y-auto">
        <SheetHeader className="border-b">
          <SheetTitle>{profile.displayName}</SheetTitle>
          <SheetDescription>{ROLE_LABEL[profile.role]}</SheetDescription>
        </SheetHeader>

        <nav aria-label="Разделы" className="grid p-2">
          {NAV[profile.role].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={close}
              className={cn(
                'rounded-md px-3 py-2.5 text-base',
                isActive(item, pathname) ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {profile.role === 'student' && (
          <section className="border-t p-4">
            <h2 className="text-muted-foreground mb-2 text-sm">Команда</h2>
            {teams.length > 0 && (
              <ul className="-mx-2 grid">
                {teams.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTeam(t.id)}
                      className="hover:bg-muted flex w-full items-center rounded-md px-2 py-2 text-left"
                    >
                      <span className="truncate">{t.name}</span>
                      {t.id === team?.id && <Check className="text-primary ml-auto size-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/team" onClick={close} className="text-primary mt-2 inline-block text-sm">
              {team ? 'Управлять командой' : 'Создать команду'}
            </Link>
          </section>
        )}

        <section className="border-t p-4">
          <h2 className="text-muted-foreground mb-2 text-sm">Тема</h2>
          <div role="radiogroup" aria-label="Тема" className="bg-muted grid grid-cols-3 rounded-md p-0.5">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-[calc(var(--radius)-6px)] px-2 py-2 text-xs',
                  theme === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-auto border-t p-4">
          <p className="text-muted-foreground mb-3 truncate text-sm">{me.email}</p>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            <LogOut />
            Выйти
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
