import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (expInSeconds: number) => `${b64({ alg: "HS256" })}.${b64({ userId: "u", exp: Math.floor(Date.now() / 1000) + expInSeconds })}.sig`;

function page(path: string, cookies: Record<string, string>, headers: Record<string, string> = {}) {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers: { cookie, ...headers } });
}
const redirected = (r: Response) => r.headers.get("location");

describe("page loads with an expired access token (AUTH-3)", () => {
  it("sends the browser through refresh when the access token has expired", () => {
    const r = middleware(page("/dashboard?tab=2", { incubator_token: jwt(-60), incubator_refresh: "x" }));
    expect(redirected(r)).toBe("http://localhost:3000/api/auth/refresh?next=%2Fdashboard%3Ftab%3D2");
  });

  it("refreshes when the access cookie is gone or about to expire", () => {
    expect(redirected(middleware(page("/finance", { incubator_refresh: "x" })))).toContain("/api/auth/refresh");
    expect(redirected(middleware(page("/finance", { incubator_token: jwt(10), incubator_refresh: "x" })))).toContain("/api/auth/refresh");
  });

  it("leaves the request alone otherwise", () => {
    expect(redirected(middleware(page("/dashboard", { incubator_token: jwt(600), incubator_refresh: "x" })))).toBeNull();
    expect(redirected(middleware(page("/dashboard", { incubator_token: jwt(-60) })))).toBeNull(); // signed out
    expect(redirected(middleware(page("/dashboard", { incubator_refresh: "x", incubator_refresh_wait: "1" })))).toBeNull();
    expect(redirected(middleware(page("/dashboard", { incubator_refresh: "x" }, { "next-router-prefetch": "1" })))).toBeNull();
  });

  it("treats a malformed token as expired", () => {
    expect(redirected(middleware(page("/", { incubator_token: "garbage", incubator_refresh: "x" })))).toContain("/api/auth/refresh");
  });
});
