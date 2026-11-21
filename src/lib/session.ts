import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth";

/** Current user from the session cookie, or null. Checks the token has not been revoked. */
export async function getSessionUser(req: NextRequest) {
  const token = req.cookies.get("incubator_token")?.value;
  if (!token) return null;
  return verifySession(token);
}
