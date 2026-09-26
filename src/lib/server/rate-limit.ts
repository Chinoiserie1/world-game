/**
 * Fixed-window in-memory rate limiter. Per-instance only — good enough to blunt
 * scripted abuse in the MVP; swap for Redis/Upstash when scaling out.
 */
export interface RateLimiter {
  check(key: string, now: number): boolean;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  let windows = new Map<string, { start: number; count: number }>();
  return {
    check(key, now) {
      if (windows.size > 10_000) windows = new Map();
      const current = windows.get(key);
      if (!current || now - current.start >= windowMs) {
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      if (current.count >= limit) return false;
      windows.set(key, { start: current.start, count: current.count + 1 });
      return true;
    },
  };
}
