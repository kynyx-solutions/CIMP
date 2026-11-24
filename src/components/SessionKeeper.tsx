"use client";
// Keeps a signed-in browser signed in (PRD AUTH-3). The access token lasts 15 minutes; when an
// API call on this site comes back 401 and the browser holds a refresh token, trade it for a new
// pair once (shared by every call waiting at that moment) and repeat the call. Many routes answer
// 403 when there is no session at all (one check covers "not signed in" and "wrong role"), so a
// 403 also triggers one refresh, at most once a minute so a real "forbidden" costs one extra call.
// Installed when this module loads, before any page code runs its effects.

const NO_RETRY = new Set([
  "/api/auth/refresh", "/api/auth/login", "/api/auth/register", "/api/auth/verify-otp", "/api/auth/resend-otp",
  "/api/auth/google", "/api/auth/forgot-password", "/api/auth/reset-password",
]);

declare global {
  interface Window { __cimpSessionKeeper?: boolean }
}

function install() {
  if (typeof window === "undefined" || window.__cimpSessionKeeper) return;
  window.__cimpSessionKeeper = true;
  const base = window.fetch.bind(window);
  let pending: Promise<boolean> | null = null;
  let lastRefresh = 0;

  const signedIn = () => document.cookie.split(";").some((c) => c.trim().startsWith("incubator_signed_in="));
  const refresh = () =>
    (pending ??= base("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
      .then((r) => { lastRefresh = Date.now(); return r.ok || r.status === 409; }) // 409: another tab refreshed first
      .catch(() => false)
      .finally(() => setTimeout(() => { pending = null; }, 0)));

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    const eligible = url.origin === location.origin && url.pathname.startsWith("/api/") && !NO_RETRY.has(url.pathname);
    // A Request's body can be read once, so keep a copy for the retry.
    const spare = eligible && input instanceof Request ? input.clone() : null;
    const res = await base(input, init);
    if (!eligible || !signedIn()) return res;
    if (res.status !== 401 && !(res.status === 403 && Date.now() - lastRefresh > 60_000)) return res;
    if (!(await refresh())) return res;
    return base(spare ?? input, init);
  };
}

install();

export default function SessionKeeper() {
  return null;
}
