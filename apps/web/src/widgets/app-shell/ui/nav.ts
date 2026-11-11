import type { Role } from '@/entities/viewer';

/** `also`: other paths that belong to the same section (sub-pages reached from it). */
export type NavItem = { to: string; label: string; also?: string[] };

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: '/sprint', label: 'Спринт' },
    { to: '/challenges', label: 'Задачи бизнеса', also: ['/applications'] },
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

export function isActive(item: NavItem, pathname: string) {
  return [item.to, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
