// Custom notification blast to a user group (PRD NOT-3): Executive, Incubation Manager, CEO, Admin IT.
//   GET                                          audiences with recipient counts + recent blasts
//   POST { audience, title, message, email }     send
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { OFFICE_ROLES, ROLE_LABELS } from "@/lib/workflow";
import { notifyUsers, MAX_EMAIL_RECIPIENTS } from "@/lib/notify";
import { audit } from "@/lib/audit";

// Emails go out at the provider's rate (src/lib/notify.ts), so a large group takes minutes
export const maxDuration = 300;

const SENDERS = ["executive", "manager", "ceo", "admin_it"];

const AUDIENCES: Record<string, { label: string; where: Prisma.UserWhereInput }> = {
  incubated: { label: "Incubated startups (approved)", where: { role: "incubatee", applications: { some: { status: "approved" } } } },
  applicants: { label: "Applicants under review", where: { role: "incubatee", applications: { some: { status: "pending" } } } },
  incubatees: { label: "All founders", where: { role: "incubatee" } },
  mentors: { label: "Approved mentors", where: { role: "mentor", mentorProfile: { status: "approved" } } },
  investors: { label: "Approved investors", where: { role: "mentor", mentorProfile: { investorStatus: "approved" } } },
  office: { label: "Office team", where: { role: { in: [...OFFICE_ROLES] } } },
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !SENDERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const audiences = await Promise.all(Object.entries(AUDIENCES).map(async ([key, a]) => ({ key, label: a.label, count: await prisma.user.count({ where: a.where }) })));
  const recent = await prisma.auditLog.findMany({ where: { action: "notification.blast" }, orderBy: { at: "desc" }, take: 15, select: { id: true, actorName: true, actorRole: true, summary: true, at: true } });
  return NextResponse.json({ audiences, recent });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !SENDERS.includes(user.role)) return NextResponse.json({ error: "Your role cannot send notifications to groups" }, { status: 403 });
  const { audience, title, message, email } = await req.json().catch(() => ({}));
  const a = AUDIENCES[audience as string];
  if (!a) return NextResponse.json({ error: "Choose an audience" }, { status: 400 });
  const t = typeof title === "string" ? title.trim().slice(0, 100) : "";
  const m = typeof message === "string" ? message.trim().slice(0, 1500) : "";
  if (t.length < 3 || m.length < 5) return NextResponse.json({ error: "Write a title and a message" }, { status: 400 });

  const users = await prisma.user.findMany({ where: { ...a.where, id: { not: user.userId } }, select: { id: true } });
  if (!users.length) return NextResponse.json({ error: "Nobody is in this group yet" }, { status: 400 });
  if (users.length > 2000) return NextResponse.json({ error: "Groups above 2,000 people cannot be notified in one go" }, { status: 400 });
  if (email === true && users.length > MAX_EMAIL_RECIPIENTS)
    return NextResponse.json({ error: `Email goes to at most ${MAX_EMAIL_RECIPIENTS} people at a time. Untick email to notify everyone in the portal, or choose a smaller group.` }, { status: 400 });

  const from = `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`;
  const sent = await notifyUsers(users.map((u) => u.id), t, `${m}\n\n— ${from}`, "info", undefined, email === true ? { ctaPath: "/dashboard", ctaLabel: "Open the portal" } : undefined);
  await audit(req, user, "notification.blast", "notification", audience, `Sent "${t}" to ${a.label}: ${sent} of ${users.length} people${email === true ? ", with email" : ""}${sent < users.length ? ` (${users.length - sent} skipped as duplicates)` : ""}`);
  return NextResponse.json({ success: true, sent, skipped: users.length - sent });
}
