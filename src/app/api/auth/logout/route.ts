import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { revokeSessions } from "@/lib/auth";
import { audit } from "@/lib/audit";

// POST            sign out of this browser
// POST ?all=1     sign out everywhere: every token issued so far stops working
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("all") === "1") {
    const session = await getSessionUser(req);
    if (session) {
      await revokeSessions(session.userId);
      await audit(req, session, "auth.logout_all", "auth", session.userId, "Signed out on every device");
    }
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set("incubator_token", "", { maxAge: 0, path: "/" });
  return response;
}
