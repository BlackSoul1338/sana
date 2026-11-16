import type { Context } from 'hono';

/** In-memory per-key counter. A Worker isolate has its own map, so this is a barrier against bulk sign-ups, not a distributed defence. */
export type RateLimiter = { allow: (key: string) => boolean; refund: (key: string) => void };

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const prune = (now: number) => {
    if (buckets.size <= 1000) return;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };
  return {
    allow(key) {
      const now = Date.now();
      prune(now);
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
    refund(key) {
      const bucket = buckets.get(key);
      if (bucket && bucket.count > 0) bucket.count -= 1;
    },
  };
}

/** cf-connecting-ip on a Worker, the first x-forwarded-for entry behind a proxy. */
export function clientIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
