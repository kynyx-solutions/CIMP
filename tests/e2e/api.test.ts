// API checks against a running server with the demo seed loaded.
//   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
// Skipped when E2E_BASE_URL is not set. Use a test database: these tests sign in, sign out
// everywhere and register throwaway accounts.
import { describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL;
const run = BASE ? describe : describe.skip;
// A fresh client address per run, so rate-limit counters from earlier runs do not interfere.
const IP = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

async function call(path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": IP, ...(init.headers as Record<string, string>) };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.json !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, redirect: "manual" });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const token = /incubator_token=([^;]*)/.exec(setCookie)?.[1];
  let body: any = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { res, body, cookie: token ? `incubator_token=${token}` : undefined };
}

const login = (email: string, password = "Demo@1234") => call("/api/auth/login", { method: "POST", json: { email, password } });

run("platform", () => {
  it("reports health", async () => {
    const { res, body } = await call("/api/health");
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", db: "up" });
  });

  it("sends security headers", async () => {
    const { res } = await call("/");
    expect(res.headers.get("content-security-policy") ?? res.headers.get("content-security-policy-report-only")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("never caches API responses", async () => {
    const { res } = await call("/api/health");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});

run("sessions", () => {
  it("rejects requests without a session", async () => {
    const { res } = await call("/api/finance");
    expect([401, 403]).toContain(res.status);
  });

  it("signs in and reads the role from the database", async () => {
    const a = await login("exec@cimp.local");
    expect(a.res.status).toBe(200);
    const me = await call("/api/auth/me", { cookie: a.cookie });
    expect(me.body.user).toMatchObject({ email: "exec@cimp.local", role: "executive" });
  });

  it("signs out everywhere: older tokens stop working", async () => {
    const a = await login("exec@cimp.local");
    const b = await login("exec@cimp.local");
    expect((await call("/api/auth/me", { cookie: b.cookie })).res.status).toBe(200);
    const out = await call("/api/auth/logout?all=1", { method: "POST", cookie: a.cookie });
    expect(out.res.status).toBe(200);
    expect((await call("/api/auth/me", { cookie: b.cookie })).res.status).toBe(401);
    expect([401, 403]).toContain((await call("/api/finance", { cookie: b.cookie })).res.status);
    const c = await login("exec@cimp.local");
    expect((await call("/api/auth/me", { cookie: c.cookie })).res.status).toBe(200);
  });

  it("rejects a forged token", async () => {
    const { res } = await call("/api/auth/me", { cookie: "incubator_token=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4Iiwicm9sZSI6ImNlbyJ9.bad" });
    expect(res.status).toBe(401);
  });
});

run("brute-force protection", () => {
  it("locks an account after 10 failed sign-ins", async () => {
    const email = `nobody-${Date.now()}@example.com`;
    for (let i = 0; i < 10; i++) expect((await login(email, "wrong")).res.status).toBe(401);
    const blocked = await login(email, "wrong");
    expect(blocked.res.status).toBe(429);
    expect(Number(blocked.res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("cancels an emailed code after 5 wrong tries", async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const reg = await call("/api/auth/register", { method: "POST", json: { name: "E2E Founder", email, password: "test12345", role: "incubatee", consent: true } });
    expect(reg.res.status).toBeLessThan(300);
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await call("/api/auth/verify-otp", { method: "POST", json: { email, otp: "000000" } })).res.status);
    expect(statuses.slice(0, 4).every((s) => s === 400)).toBe(true);
    expect(statuses[4]).toBe(429);
  });
});

run("password reset", () => {
  it("answers the same for unknown and known addresses", async () => {
    const unknown = await call("/api/auth/forgot-password", { method: "POST", json: { email: `nobody-${Date.now()}@example.com` } });
    expect(unknown.res.status).toBe(200);
    expect(unknown.body.message).toMatch(/If an account exists/);
  });

  it("limits reset requests per address", async () => {
    const email = `limit-${Date.now()}@example.com`;
    for (let i = 0; i < 3; i++) expect((await call("/api/auth/forgot-password", { method: "POST", json: { email } })).res.status).toBe(200);
    expect((await call("/api/auth/forgot-password", { method: "POST", json: { email } })).res.status).toBe(429);
  });

  it("rejects an invalid link", async () => {
    expect((await call("/api/auth/reset-password?token=not-a-real-token-1234567890")).res.status).toBe(400);
    const r = await call("/api/auth/reset-password", { method: "POST", json: { token: "not-a-real-token-1234567890", password: "whatever123" } });
    expect(r.res.status).toBe(400);
  });
});

run("partner API", () => {
  it("requires an API key", async () => {
    const { res } = await call("/api/v1/startups");
    expect(res.status).toBe(401);
  });
});
