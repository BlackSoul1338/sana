import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useMe } from '@/entities/viewer';
import { cn } from '@/shared/lib/utils';
import { Logo } from '@/shared/ui/logo';
import { MobileMenu } from './mobile-menu';
import { isActive, NAV } from './nav';
import { TeamSwitcher } from './team-switcher';
import { UserMenu } from './user-menu';

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const role = me.profile!.role;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh">
      <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link to="/" aria-label="На главную">
            <Logo />
          </Link>
          <nav aria-label="Разделы" className="-mb-px hidden h-full items-stretch gap-1 md:flex">
            {NAV[role].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item, pathname) ? 'page' : undefined}
                className={cn(
                  'flex items-center border-b-2 px-2.5 text-sm whitespace-nowrap transition-colors',
                  isActive(item, pathname)
                    ? 'text-foreground border-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {role === 'student' && <TeamSwitcher />}
            <UserMenu />
          </div>
          <div className="ml-auto md:hidden">
            <MobileMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:pt-8">{children}</main>
    </div>
  );
}
