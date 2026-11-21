// Mentor hub summary (PRD MEN-4, INV-1): upcoming sessions across all mentees, documents
// waiting for the mentor, and investor pitches.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "mentor") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const conns = await prisma.connection.findMany({ where: { mentorId: user.userId, status: "active" }, select: { id: true, applicationId: true, incubatee: { select: { name: true } } } });
  const ids = conns.map((c) => c.id);
  const apps = new Map((await prisma.application.findMany({ where: { id: { in: conns.map((c) => c.applicationId).filter((x): x is string => !!x) } }, select: { id: true, startupName: true } })).map((a) => [a.id, a.startupName]));
  const nameOf = (connectionId: string) => { const c = conns.find((x) => x.id === connectionId); return (c?.applicationId && apps.get(c.applicationId)) || c?.incubatee.name || ""; };
  const [sessions, uploads, toRate, pitches] = await Promise.all([
    prisma.mentorSession.findMany({ where: { connectionId: { in: ids }, status: "scheduled" }, orderBy: { scheduledAt: "asc" }, take: 5 }),
    prisma.docRequest.findMany({ where: { connectionId: { in: ids }, status: "uploaded" }, orderBy: { uploadedAt: "desc" }, take: 5 }),
    prisma.mentorSession.findMany({ where: { connectionId: { in: ids }, status: "completed", feedback: { none: { authorId: user.userId } } }, take: 5 }),
    prisma.investmentProposal.findMany({ where: { investorId: user.userId, status: "pitch_scheduled" }, include: { application: { select: { startupName: true } } }, orderBy: { pitchAt: "asc" } }),
  ]);
  return NextResponse.json({
    sessions: sessions.map((s) => ({ id: s.id, connectionId: s.connectionId, startup: nameOf(s.connectionId), scheduledAt: s.scheduledAt, mode: s.mode, overdue: s.scheduledAt < new Date() })),
    uploads: uploads.map((d) => ({ id: d.id, connectionId: d.connectionId, startup: nameOf(d.connectionId), title: d.title })),
    toRate: toRate.map((s) => ({ id: s.id, connectionId: s.connectionId, startup: nameOf(s.connectionId), scheduledAt: s.scheduledAt })),
    pitches: pitches.map((p) => ({ id: p.id, startup: p.application.startupName, pitchAt: p.pitchAt })),
  });
}
