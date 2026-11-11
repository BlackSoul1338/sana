import { Monitor, Moon, Sun } from 'lucide-react';
import type { Theme } from '@/shared/lib/theme-context';

export const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'system', label: 'Как в системе', icon: Monitor },
];
