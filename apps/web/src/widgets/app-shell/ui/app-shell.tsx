import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useMe, type Role } from '@/entities/viewer';
import { Logo } from '@/shared/ui/logo';
import { TeamSwitcher } from './team-switcher';
import { UserMenu } from './user-menu';

type NavItem = { to: string; label: string };

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/sprint', label: 'Спринт' },
    { to: '/team', label: 'Команда' },
    { to: '/challenges', label: 'Задачи бизнеса' },
    { to: '/applications', label: 'Заявки' },
    { to: '/leaderboard', label: 'Рейтинг' },
  ],
  mentor: [
    { to: '/review', label: 'Проверка' },
    { to: '/projects', label: 'Проекты' },
    { to: '/leaderboard', label: 'Рейтинг' },
  ],
  business: [
    { to: '/builder', label: 'Конструктор' },
    { to: '/tasks', label: 'Мои задачи' },
    { to: '/leaderboard', label: 'Рейтинг' },
  ],
};

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const role = me.profile!.role;

  return (
    <div className="min-h-dvh">
      <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" aria-label="На главную">
            <Logo />
          </Link>
          <nav className="-mb-px flex h-full items-stretch gap-1 overflow-x-auto">
            {NAV[role].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-muted-foreground hover:text-foreground flex items-center border-b-2 border-transparent px-2.5 text-sm whitespace-nowrap transition-colors"
                activeProps={{ className: '!text-foreground !border-primary font-medium' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {role === 'student' && <TeamSwitcher />}
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">{children}</main>
    </div>
  );
}
