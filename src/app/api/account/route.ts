// The signed-in user's own account (profile and settings pages).
//   GET                              account details + role-specific summary
//   PATCH { name }                   rename (re-issues the session cookie so the new name shows everywhere)
//   POST  { currentPassword, newPassword }   change password
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { signToken, revokeSessions, type Role } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { audit } from "@/lib/audit";

const COOKIE = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, path: "/",
};

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, name: true, email: true, role: true, image: true, createdAt: true, consentAt: true, password: true,
      applications: { select: { id: true, startupName: true, stage: true, status: true, isPublic: true }, take: 1 },
      mentorProfile: { select: { id: true, status: true, investorStatus: true, isPublic: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const { password, applications, ...rest } = user;
  return NextResponse.json({
    account: {
      ...rest,
      hasPassword: !!password,
      isStaff: isStaffRole(user.role),
      application: applications[0] ?? null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (clean.length < 2 || clean.length > 80) return NextResponse.json({ error: "Name must be 2 to 80 characters" }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true, role: true, image: true, sessionVersion: true } });
  if (!before) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (before.name === clean) return NextResponse.json({ error: "That is already your name" }, { status: 400 });

  await prisma.user.update({ where: { id: session.userId }, data: { name: clean } });
  await audit(req, session, "user.rename", "user", session.userId, `Changed account name from "${before.name}" to "${clean}"`,
    { name: { from: before.name, to: clean } });

  const res = NextResponse.json({ success: true, name: clean });
  res.cookies.set("incubator_token", signToken({
    userId: session.userId, email: before.email, name: clean, role: before.role as Role, sv: before.sessionVersion, ...(before.image ? { image: before.image } : {}),
  }), COOKIE);
  return res;
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { password: true, role: true, name: true, email: true, image: true } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  if (!user.password) return NextResponse.json({ error: "You sign in with Google, so there is no password to change here." }, { status: 400 });

  // Office accounts need a longer password (same rule as when the CEO creates them).
  const min = isStaffRole(user.role) ? 8 : 6;
  if (typeof newPassword !== "string" || newPassword.length < min || newPassword.length > 128)
    return NextResponse.json({ error: `New password must be at least ${min} characters` }, { status: 400 });
  if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.password))) {
    await audit(req, session, "user.password_change_failed", "user", session.userId, "Password change failed: wrong current password");
    return NextResponse.json({ error: "Your current password is not correct" }, { status: 400 });
  }
  if (await bcrypt.compare(newPassword, user.password))
    return NextResponse.json({ error: "Choose a password different from your current one" }, { status: 400 });

  await prisma.user.update({ where: { id: session.userId }, data: { password: await bcrypt.hash(newPassword, 12) } });
  // A new password signs out every other device; this browser gets a fresh session.
  const sv = await revokeSessions(session.userId);
  await audit(req, session, "user.password_change", "user", session.userId, "Changed account password (other sessions signed out)");
  const res = NextResponse.json({ success: true });
  res.cookies.set("incubator_token", signToken({ userId: session.userId, email: user.email, name: user.name, role: user.role as Role, sv, ...(user.image ? { image: user.image } : {}) }), COOKIE);
  return res;
}
