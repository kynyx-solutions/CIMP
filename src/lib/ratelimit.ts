// Fixed-window rate limiter (server-only). Counters live in this process, which is right for a
// single server; with several instances behind a load balancer, move them to Redis (PRD §8).
import { NextResponse, type NextRequest } from "next/server";

/**
 * The address to count against. Behind the reverse proxy (Caddy in docker-compose, or a load
 * balancer) the last X-Forwarded-For entry is the one the proxy added, so a client cannot pick
 * its own; the first entries are client-supplied and ignored here.
 */
export function limiterIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const last = fwd?.split(",").pop()?.trim();
  return (last || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

const windows = new Map<string, { n: number; reset: number }>();
let lastSweep = Date.now();

/** Count one hit for `key`. Returns ok=false once more than `limit` hits fall in the window. */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    windows.forEach((w, k) => { if (w.reset < now) windows.delete(k); });
    lastSweep = now;
  }
  const w = windows.get(key);
  if (!w || w.reset < now) {
    windows.set(key, { n: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  w.n++;
  return { ok: w.n <= limit, retryAfter: Math.ceil((w.reset - now) / 1000) };
}

/** Forget a key (for example after a successful sign-in). */
export function resetLimit(key: string) {
  windows.delete(key);
}

export function tooMany(retryAfter: number, what = "attempts") {
  const mins = Math.max(1, Math.ceil(retryAfter / 60));
  return NextResponse.json(
    { error: `Too many ${what}. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/**
 * Apply several limits at once (e.g. per IP and per email). Returns a 429 response for the
 * first limit exceeded, or null when the request may go ahead.
 */
export function limitRequest(req: NextRequest, rules: { key: string; limit: number; windowMs: number }[], what?: string) {
  const ip = limiterIp(req);
  for (const r of rules) {
    const res = rateLimit(r.key.replace("{ip}", ip), r.limit, r.windowMs);
    if (!res.ok) return tooMany(res.retryAfter, what);
  }
  return null;
}
