import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const ThemeContext = createContext<{ theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void } | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
