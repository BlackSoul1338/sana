import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

const KEY = 'sana-theme';

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // storage unavailable
  }
  return 'system';
}

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [resolved, setResolved] = useState(() => resolve(theme));

  useEffect(() => {
    const apply = () => {
      const r = resolve(theme);
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // storage unavailable
    }
  }, []);

  return <ThemeContext value={{ theme, resolved, setTheme }}>{children}</ThemeContext>;
}
