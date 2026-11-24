import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withId, isId } from "@/lib/serialize";
import { prisma } from "@/lib/prisma";
import { forgetSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";
import { getCompanyDomains, isCompanyEmail } from "@/lib/roles";
import { OFFICE_ROLES, ROLE_LABELS } from "@/lib/workflow";
import { sendWelcomeEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

// Roles the CEO can assign. The CEO account itself is CLI-only (PRD ACC-2).
const ASSIGNABLE_ROLES = OFFICE_ROLES.filter((r) => r !== "ceo");

// Only the CEO (owner) can manage office users (PRD ACC-3).
async function getCEO(req: NextRequest) {
  const user = await getSessionUser(req);
  return user?.role === "ceo" ? user : null;
}

// GET — list office users (excluding the CEO)
export async function GET(req: NextRequest) {
  if (!(await getCEO(req)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await prisma.user.findMany({
    where: { role: { in: ASSIGNABLE_ROLES } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    members: withId(members),
    domains: getCompanyDomains(),
    roles: ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
  });
}

// POST — create an office user { name, email, password, role }
export async function POST(req: NextRequest) {
  const ceo = await getCEO(req);
  if (!ceo)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, email, password, role } = await req.json();
  if (!name?.trim() || !email?.trim() || !password || !role)
    return NextResponse.json(
      { error: "Name, email, password and role are required" },
      { status: 400 },
    );

  if (!ASSIGNABLE_ROLES.includes(role))
    return NextResponse.json({ error: "Invalid office role" }, { status: 400 });

  if (!isCompanyEmail(email))
    return NextResponse.json(
      {
        error: `Office users must use a company email (${getCompanyDomains().join(", ") || "COMPANY_EMAIL_DOMAINS not configured"}).`,
      },
      { status: 400 },
    );

  if (password.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing)
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 },
    );

  const member = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 12),
      role,
      isVerified: true,
    },
  });

  await audit(req, ceo, "user.create", "user", member.id, `Created office user ${member.name} (${ROLE_LABELS[role] ?? role}, ${member.email})`);

  // Best-effort onboarding email; creation succeeds even if mail fails.
  try {
    await sendWelcomeEmail(member.email, member.name, role);
  } catch (err) {
    console.error("Office user welcome email failed:", err);
  }

  return NextResponse.json(
    {
      success: true,
      member: {
        _id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        createdAt: member.createdAt,
      },
    },
    { status: 201 },
  );
}

// DELETE — remove an office user ?userId=xxx
export async function DELETE(req: NextRequest) {
  const ceo = await getCEO(req);
  if (!ceo)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!isId(userId))
    return NextResponse.json({ error: "Valid userId required" }, { status: 400 });

  const target = await prisma.user.findFirst({ where: { id: userId, role: { in: ASSIGNABLE_ROLES } }, select: { name: true, email: true, role: true } });
  if (!target)
    return NextResponse.json({ error: "Office user not found" }, { status: 404 });
  await prisma.user.delete({ where: { id: userId } });
  forgetSession(userId); // its sessions stop working immediately
  await audit(req, ceo, "user.delete", "user", userId, `Removed office user ${target.name} (${ROLE_LABELS[target.role] ?? target.role}, ${target.email})`);

  return NextResponse.json({ success: true });
}
