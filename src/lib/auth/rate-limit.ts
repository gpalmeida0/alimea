// ---------------------------------------------------------------------------
// Attempt limiter for the auth endpoints (sign-in, 2FA codes, reset emails).
//
// Counters live in this server instance's memory: enough to stop someone
// hammering a password from one place, and it needs no extra infrastructure.
// Supabase Auth applies its own per-project limits on top of this.
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __alimeaAttempts?: Map<string, Bucket> };
const buckets = (g.__alimeaAttempts ??= new Map());
const MAX_BUCKETS = 10_000;

export interface Limit {
  max: number;
  windowMs: number;
}

export const LOGIN_LIMIT: Limit = { max: 8, windowMs: 15 * 60_000 };
export const MFA_LIMIT: Limit = { max: 6, windowMs: 10 * 60_000 };
export const RESET_LIMIT: Limit = { max: 3, windowMs: 60 * 60_000 };

function live(key: string, now: number): Bucket | undefined {
  const b = buckets.get(key);
  if (b && b.resetAt <= now) {
    buckets.delete(key);
    return undefined;
  }
  return b;
}

/** True when `key` has used up its attempts for the current window. */
export function isLimited(key: string, limit: Limit, now = Date.now()): boolean {
  return (live(key, now)?.count ?? 0) >= limit.max;
}

/** Record one attempt against `key`. */
export function recordAttempt(key: string, limit: Limit, now = Date.now()): void {
  const b = live(key, now);
  if (b) {
    b.count += 1;
    return;
  }
  if (buckets.size >= MAX_BUCKETS) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
  }
  buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
}

export function clearAttempts(key: string): void {
  buckets.delete(key);
}
