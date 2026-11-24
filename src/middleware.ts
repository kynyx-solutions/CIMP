// Page loads with an expired access token (PRD AUTH-3).
// The access cookie lasts 15 minutes. When a page is requested without a usable one but with a
// refresh cookie, send the browser through /api/auth/refresh, which issues a new pair and comes
// straight back. API calls are refreshed by the browser instead (src/components/SessionKeeper.tsx).
// Runs on the edge, so it only reads the token's expiry; the token itself is verified by the page.
import { NextResponse, type NextRequest } from "next/server";

function expiresSoon(jwt: string | undefined) {
  if (!jwt) return true;
  try {
    const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
    return typeof exp !== "number" || exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

// CSRF: state-changing API calls must come from the portal's own pages. Browsers always send
// Origin (and Sec-Fetch-Site) on these requests; a request without either is not from a browser.
// /api/cron and /api/v1 authenticate with a secret or key instead of the session cookie.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_ROUTES = /^\/api\/(cron|v1)\//;

function crossSite(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    let host: string;
    try { host = new URL(origin).host; } catch { return true; }
    const allowed = new Set([req.headers.get("host"), req.nextUrl.host]);
    try { if (process.env.NEXT_PUBLIC_APP_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).host); } catch {}
    return !allowed.has(host);
  }
  const site = req.headers.get("sec-fetch-site");
  return site === "cross-site" || site === "same-site";
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (!SAFE_METHODS.has(req.method) && !TOKEN_ROUTES.test(req.nextUrl.pathname) && crossSite(req))
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    return NextResponse.next();
  }
  if (req.method !== "GET") return NextResponse.next();
  if (!req.cookies.get("incubator_refresh")?.value || req.cookies.get("incubator_refresh_wait")) return NextResponse.next();
  // Prefetches are speculative; the real navigation refreshes if needed.
  if (req.headers.get("next-router-prefetch") || req.headers.get("purpose") === "prefetch") return NextResponse.next();
  if (!expiresSoon(req.cookies.get("incubator_token")?.value)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/api/auth/refresh";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Pages (session refresh) and API routes (CSRF check); not build assets or files with an extension.
  matcher: ["/api/:path*", "/((?!api/|_next/|favicon\\.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
