// The signed-in user's conversations, newest first, with unread counts (PRD MSG-1, MSG-2).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canMessageApplicants } from "@/lib/workflow";
import { fromOthers, isNetworkOffice, type ThreadType } from "@/lib/chat";

type Thread = {
  type: ThreadType; id: string; title: string; subtitle: string; group: string;
  unread: number; lastAt: string | null; lastText: string | null; stage?: string;
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const office = canMessageApplicants(user.role);
  const threads: Thread[] = [];

  // ── Application threads: incubatee ↔ office ──
  if (user.role === "incubatee" || office) {
    const apps = await prisma.application.findMany({
      where: office ? {} : { userId: user.userId },
      select: { id: true, startupName: true, applicantName: true, stage: true },
    });
    const ids = apps.map((a) => a.id);
    const [last, unread] = await Promise.all([
      prisma.message.findMany({ where: { applicationId: { in: ids } }, orderBy: { createdAt: "desc" }, distinct: ["applicationId"], select: { applicationId: true, content: true, createdAt: true } }),
      prisma.message.groupBy({ by: ["applicationId"], where: { applicationId: { in: ids }, read: false, ...fromOthers(user.userId), ...(office ? { senderRole: "incubatee" } : {}) }, _count: true }),
    ]);
    const lastBy = new Map(last.map((m) => [m.applicationId, m]));
    const unreadBy = new Map(unread.map((u) => [u.applicationId, u._count]));
    for (const a of apps) {
      const m = lastBy.get(a.id);
      threads.push({
        type: "application", id: a.id, group: office ? "Applicants" : "CIMP-BIIF office",
        title: office ? a.startupName : "Incubation team",
        subtitle: office ? a.applicantName : `About ${a.startupName}`,
        stage: a.stage, unread: unreadBy.get(a.id) ?? 0,
        lastAt: m?.createdAt.toISOString() ?? null, lastText: m?.content ?? null,
      });
    }
  }

  // ── Mentor ↔ office threads ──
  const mentorOffice: { id: string; title: string; subtitle: string }[] = [];
  if (user.role === "mentor") {
    mentorOffice.push({ id: user.userId, title: "CIMP-BIIF office", subtitle: "Incubation team" });
  } else if (office && isNetworkOffice(user.role)) {
    const profiles = await prisma.mentorProfile.findMany({
      where: { status: { in: ["submitted", "approved"] } },
      select: { userId: true, headline: true, investorStatus: true, user: { select: { name: true } } },
    });
    for (const p of profiles)
      mentorOffice.push({ id: p.userId, title: p.user.name, subtitle: p.investorStatus === "approved" ? `Mentor & investor · ${p.headline}` : p.headline });
  }

  // ── Incubatee ↔ mentor threads (accepted connections; office reads for oversight) ──
  const conns = await prisma.connection.findMany({
    where: user.role === "incubatee" ? { incubateeId: user.userId, status: "active" }
      : user.role === "mentor" ? { mentorId: user.userId, status: "active" }
      : office ? { status: "active" } : { id: "none" },
    select: { id: true, incubatee: { select: { name: true } }, mentor: { select: { name: true } }, applicationId: true },
  });
  const appNames = new Map(
    (await prisma.application.findMany({ where: { id: { in: conns.map((c) => c.applicationId).filter((x): x is string => !!x) } }, select: { id: true, startupName: true } }))
      .map((a) => [a.id, a.startupName]),
  );

  const chatIds = [...mentorOffice.map((m) => m.id), ...conns.map((c) => c.id)];
  const [lastChat, unreadChat] = await Promise.all([
    prisma.chatMessage.findMany({ where: { threadId: { in: chatIds } }, orderBy: { createdAt: "desc" }, distinct: ["threadType", "threadId"], select: { threadType: true, threadId: true, content: true, createdAt: true } }),
    prisma.chatMessage.groupBy({
      by: ["threadType", "threadId"],
      where: {
        threadId: { in: chatIds }, read: false, ...fromOthers(user.userId),
        // the office only counts mentor-sent messages in office threads; oversight threads never count
        ...(office ? { threadType: "mentor_office", senderRole: "mentor" } : {}),
      },
      _count: true,
    }),
  ]);
  const key = (t: string, id: string) => `${t}:${id}`;
  const lastChatBy = new Map(lastChat.map((m) => [key(m.threadType, m.threadId), m]));
  const unreadChatBy = new Map(unreadChat.map((u) => [key(u.threadType, u.threadId), u._count]));

  for (const m of mentorOffice) {
    const l = lastChatBy.get(key("mentor_office", m.id));
    threads.push({
      type: "mentor_office", id: m.id, group: office ? "Mentors & investors" : "CIMP-BIIF office",
      title: m.title, subtitle: m.subtitle, unread: unreadChatBy.get(key("mentor_office", m.id)) ?? 0,
      lastAt: l?.createdAt.toISOString() ?? null, lastText: l?.content ?? null,
    });
  }
  for (const c of conns) {
    const l = lastChatBy.get(key("connection", c.id));
    const startup = c.applicationId ? appNames.get(c.applicationId) : undefined;
    threads.push({
      type: "connection", id: c.id,
      group: office ? "Mentor conversations (read-only)" : user.role === "mentor" ? "My startups" : "My mentors",
      title: office ? `${startup ?? c.incubatee.name} ↔ ${c.mentor.name}` : user.role === "mentor" ? startup ?? c.incubatee.name : c.mentor.name,
      subtitle: office ? "Accepted connection" : user.role === "mentor" ? c.incubatee.name : "Mentor",
      unread: unreadChatBy.get(key("connection", c.id)) ?? 0,
      lastAt: l?.createdAt.toISOString() ?? null, lastText: l?.content ?? null,
    });
  }

  threads.sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0) || (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  return NextResponse.json({ threads, unreadTotal: threads.reduce((n, t) => n + t.unread, 0) });
}
