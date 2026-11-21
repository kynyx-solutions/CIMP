// Refresh-token rotation (PRD AUTH-3).
//   POST          trade the refresh cookie for a new access + refresh pair (the browser's fetch wrapper)
//   GET ?next=    the same, then back to the page (middleware sends page loads here when the
//                 access token has expired)
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, rotateRefresh, startSession, type RotateResult } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { limitRequest } from "@/lib/ratelimit";

/** Read by src/middleware.ts. */
const REFRESH_WAIT = "incubator_refresh_wait";

async function refresh(req: NextRequest, res: NextResponse): Promise<RotateResult> {
  const r = await rotateRefresh(req);
  if (r.ok) await startSession(res, req, r.user, r.family);
  else if (r.reason === "reused") {
    clearSessionCookies(res);
    await audit(req, r.user, "auth.refresh_reuse", "auth", r.user.userId, "A used refresh token was presented again; signed out on every device");
  } else if (r.reason !== "raced") clearSessionCookies(res);
  return r;
}

export async function POST(req: NextRequest) {
  const limited = limitRequest(req, [{ key: "refresh-ip:{ip}", limit: 120, windowMs: 15 * 60_000 }], "refreshes");
  if (limited) return limited;
  const res = NextResponse.json({ success: true });
  const r = await refresh(req, res);
  if (r.ok) return res;
  // Another tab refreshed a moment ago; its cookies already apply, so the caller just retries.
  if (r.reason === "raced") return NextResponse.json({ success: true, raced: true }, { status: 409 });
  const out = NextResponse.json({ error: "Your session has ended. Sign in again." }, { status: 401 });
  clearSessionCookies(out);
  return out;
}

/** Only paths on this site, never back into this route. */
function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return "/dashboard";
  return next;
}

export async function GET(req: NextRequest) {
  const target = new URL(safeNext(req.nextUrl.searchParams.get("next")), req.nextUrl.origin);
  const res = NextResponse.redirect(target, 303);
  // When no new pair was issued here, tell middleware not to send the page straight back
  // (which would loop); the page then loads as it would signed out.
  const pause = () => res.cookies.set(REFRESH_WAIT, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10, path: "/" });
  if (limitRequest(req, [{ key: "refresh-ip:{ip}", limit: 120, windowMs: 15 * 60_000 }], "refreshes")) { pause(); return res; }
  const r = await refresh(req, res);
  if (!r.ok && r.reason === "raced") pause();
  return res;
}
