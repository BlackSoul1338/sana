import { useEffect, useRef, useState } from 'react';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Counts up to `to`, starting from `from` on mount and from the shown value on later changes; reduced motion shows `to` at once. */
export function useCountUp(to: number, from: number, durationMs = 900) {
  const [value, setValue] = useState(from);
  const shown = useRef(from);
  useEffect(() => {
    const start = shown.current;
    if (start === to || prefersReducedMotion()) {
      shown.current = to;
      setValue(to);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / durationMs));
      shown.current = Math.round(start + (to - start) * (1 - (1 - t) ** 3));
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, durationMs]);
  return value;
}

/**
 * What this viewer saw last time on this page, read once per mount; the current value is stored for next time.
 * Browser storage is a convenience: without it the page simply shows no "since last visit" changes.
 */
export function useLastSeen<T>(key: string, current: T | undefined): T | null {
  const [previous] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  });
  const serialized = current === undefined ? undefined : JSON.stringify(current);
  useEffect(() => {
    if (serialized === undefined) return;
    try {
      localStorage.setItem(key, serialized);
    } catch {
      /* storage unavailable: nothing to remember */
    }
  }, [key, serialized]);
  return previous;
}
