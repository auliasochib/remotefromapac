/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Suited to a single-region serverless deployment: each Vercel function
 * instance keeps its own counters, so limits are approximate under high
 * concurrency. For strict global limits, swap the store for Upstash Redis —
 * the call sites only depend on checkRateLimit().
 */

interface Window {
  hits: number[];
}

const buckets = new Map<string, Window>();

/** Periodically drop stale buckets so the map cannot grow unbounded. */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number, windowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, window] of buckets) {
    const last = window.hits[window.hits.length - 1];
    if (!last || now - last > windowMs) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (only set when limited). */
  retryAfter: number;
  remaining: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanup(now, windowMs);

  const window = buckets.get(key) ?? { hits: [] };
  window.hits = window.hits.filter((t) => now - t < windowMs);

  if (window.hits.length >= limit) {
    const oldest = window.hits[0];
    buckets.set(key, window);
    return {
      ok: false,
      retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000),
      remaining: 0,
    };
  }

  window.hits.push(now);
  buckets.set(key, window);
  return { ok: true, retryAfter: 0, remaining: limit - window.hits.length };
}

/** Best-effort client IP from Vercel/standard proxy headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
