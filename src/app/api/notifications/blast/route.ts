// Custom notification blast to a user group (PRD NOT-3): Executive, Incubation Manager, CEO, Admin IT.
//   GET                                          audiences with recipient counts + recent blasts
//   POST { audience, title, message, email }     send
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { OFFICE_ROLES, ROLE_LABELS } from "@/lib/workflow";
import { notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

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
  if (users.length > 2000) return NextResponse.json({ error: "Groups above 2,000 people are sent from the Phase 1 job queue" }, { status: 400 });

  const from = `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`;
  const sent = await notifyUsers(users.map((u) => u.id), t, `${m}\n\n— ${from}`, "info", undefined, email === true ? { ctaPath: "/dashboard", ctaLabel: "Open the portal" } : undefined);
  await audit(req, user, "notification.blast", "notification", audience, `Sent "${t}" to ${a.label}: ${sent} of ${users.length} people${email === true ? ", with email" : ""}${sent < users.length ? ` (${users.length - sent} skipped as duplicates)` : ""}`);
  return NextResponse.json({ success: true, sent, skipped: users.length - sent });
}
