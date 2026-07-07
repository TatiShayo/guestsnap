/**
 * Sliding-window rate limiter. In-memory (per server instance) — adequate
 * for a single Vercel region at launch volume; swap the store for Upstash
 * Redis when scaling (interface is drop-in, see NEEDS HUMAN in README).
 */

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  // Occasionally clear stale keys so the map can't grow unbounded.
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, win] of store) {
    win.timestamps = win.timestamps.filter((t) => now - t < windowMs);
    if (win.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);
  let win = store.get(key);
  if (!win) {
    win = { timestamps: [] };
    store.set(key, win);
  }
  win.timestamps = win.timestamps.filter((t) => now - t < windowMs);
  if (win.timestamps.length >= limit) {
    const oldest = win.timestamps[0];
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  win.timestamps.push(now);
  return { ok: true, remaining: limit - win.timestamps.length, retryAfterSec: 0 };
}

/** Named limit presets so routes stay consistent. */
export const LIMITS = {
  uploadPerIp: { limit: 60, windowMs: 10 * 60_000 },
  uploadPerEvent: { limit: 400, windowMs: 10 * 60_000 },
  authPerIp: { limit: 5, windowMs: 15 * 60_000 },
  pinPerIp: { limit: 5, windowMs: 60_000 },
  reportPerIp: { limit: 10, windowMs: 60_000 },
  albumSignupPerIp: { limit: 10, windowMs: 60_000 },
  checkoutPerUser: { limit: 10, windowMs: 60_000 },
} as const;

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** test hook */
export function _resetRateLimits() {
  store.clear();
}
