import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

/** Current user from the session cookie, or null. */
export function getSessionUser(req: NextRequest) {
  const token = req.cookies.get("incubator_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}
