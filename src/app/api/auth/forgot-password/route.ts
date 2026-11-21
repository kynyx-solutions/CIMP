import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { audit, clientIp } from "@/lib/audit";
import { limitRequest } from "@/lib/ratelimit";
import { sendPasswordResetEmail } from "@/lib/email";

const TTL_MS = 30 * 60_000;
// Same answer whether or not the address has an account, so the form cannot be used to find accounts.
const SENT = { success: true, message: "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder." };

// POST { email }: email a single-use reset link (PRD AUTH-4)
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim()))
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const addr = email.trim().toLowerCase();

  const limited = limitRequest(req, [
    { key: `forgot:${addr}`, limit: 3, windowMs: 15 * 60_000 },
    { key: "forgot-ip:{ip}", limit: 10, windowMs: 15 * 60_000 },
  ], "reset requests");
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { email: addr }, select: { id: true, name: true, email: true, role: true } });
  if (!user) return NextResponse.json(SENT);

  const token = randomBytes(32).toString("base64url");
  // A new link replaces any earlier unused one
  await prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + TTL_MS), ip: clientIp(req) },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    await sendPasswordResetEmail(user.email, user.name, `${appUrl}/reset-password?token=${token}`);
  } catch (err) {
    console.error("Password reset email failed:", err);
    return NextResponse.json({ error: "We could not send the email right now. Please try again in a few minutes." }, { status: 503 });
  }
  await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.password_reset_requested", "auth", user.id, "Asked for a password reset link");
  return NextResponse.json(SENT);
}
