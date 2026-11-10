import { useCallback, useSyncExternalStore } from 'react';
import { useMe } from './me';

const KEY = 'sana-active-team';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Student's current team: stored choice if still a member, otherwise the first team. */
export function useActiveTeam() {
  const me = useMe();
  const stored = useSyncExternalStore(subscribe, read);
  const team = me.teams.find((t) => t.id === stored) ?? me.teams[0] ?? null;

  const setActiveTeam = useCallback((id: string) => {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // storage unavailable
    }
    listeners.forEach((l) => l());
  }, []);

  return { team, teams: me.teams, setActiveTeam };
}
