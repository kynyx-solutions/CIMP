import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { endSession, revokeSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";

// POST            sign out of this browser
// POST ?all=1     sign out everywhere: every access and refresh token issued so far stops working
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("all") === "1") {
    const session = await getSessionUser(req);
    // 401 (not a silent success) so the browser refreshes an expired access token and retries
    if (!session) return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    await revokeSessions(session.userId);
    await audit(req, session, "auth.logout_all", "auth", session.userId, "Signed out on every device");
  }
  const response = NextResponse.json({ success: true });
  await endSession(req, response);
  return response;
}
