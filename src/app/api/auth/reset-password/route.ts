import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { revokeSessions } from "@/lib/auth";
import { limitRequest } from "@/lib/ratelimit";
import { isStaffRole } from "@/lib/roles";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const INVALID = "This reset link is invalid or has expired. Ask for a new one.";

async function findValid(token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const r = await prisma.passwordReset.findUnique({ where: { tokenHash: hash(token) }, include: { user: { select: { id: true, name: true, role: true, email: true } } } });
  return r && !r.usedAt && r.expiresAt > new Date() ? r : null;
}

// GET ?token=: check a link before showing the form
export async function GET(req: NextRequest) {
  const r = await findValid(req.nextUrl.searchParams.get("token"));
  if (!r) return NextResponse.json({ error: INVALID }, { status: 400 });
  return NextResponse.json({ valid: true, email: r.user.email, minLength: isStaffRole(r.user.role) ? 8 : 6 });
}

// POST { token, password }: set the new password; every session of the account is signed out
export async function POST(req: NextRequest) {
  const limited = limitRequest(req, [{ key: "reset-ip:{ip}", limit: 20, windowMs: 15 * 60_000 }], "attempts");
  if (limited) return limited;
  const { token, password } = await req.json().catch(() => ({}));
  const r = await findValid(token);
  if (!r) return NextResponse.json({ error: INVALID }, { status: 400 });

  const min = isStaffRole(r.user.role) ? 8 : 6;
  if (typeof password !== "string" || password.length < min || password.length > 128)
    return NextResponse.json({ error: `Password must be ${min} to 128 characters` }, { status: 400 });

  // Mark used first, guarded on usedAt, so the same link cannot be used twice in parallel
  const claimed = await prisma.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return NextResponse.json({ error: INVALID }, { status: 400 });

  // The link proves the person controls the email address, so the account counts as verified
  await prisma.user.update({ where: { id: r.userId }, data: { password: await bcrypt.hash(password, 12), isVerified: true, otp: null, otpExpiresAt: null } });
  await prisma.passwordReset.deleteMany({ where: { userId: r.userId, usedAt: null } });
  await revokeSessions(r.userId);
  await audit(req, { userId: r.user.id, name: r.user.name, role: r.user.role }, "auth.password_reset", "auth", r.userId, "Reset password with an emailed link (all sessions signed out)");
  return NextResponse.json({ success: true });
}
