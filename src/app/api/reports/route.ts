// Programme reports (PRD RBAC-5): pipeline, approvals, sectors, mentoring, QPR compliance.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { REPORT_ROLES } from "@/lib/exports";
import { PIPELINE, STAGES, type Stage } from "@/lib/workflow";
import { periodOf, previousPeriod, periodLabel } from "@/lib/qpr";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !REPORT_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [apps, approvals, mentors, conns, sessions, feedback, proposals] = await Promise.all([
    prisma.application.findMany({ select: { id: true, stage: true, status: true, industry: true, createdAt: true, isPublic: true } }),
    prisma.approvalStep.findMany({ where: { toStage: "ceo_approved" }, select: { applicationId: true, at: true } }),
    prisma.mentorProfile.findMany({ select: { status: true, investorStatus: true } }),
    prisma.connection.findMany({ select: { status: true } }),
    prisma.mentorSession.findMany({ select: { status: true } }),
    prisma.sessionFeedback.findMany({ select: { rating: true } }),
    prisma.investmentProposal.findMany({ select: { status: true } }),
  ]);

  // Pipeline: open applications by stage, in workflow order
  const byStage = [...PIPELINE, "returned", "rejected"].map((s) => ({ key: s, label: STAGES[s as Stage]?.label ?? s, count: apps.filter((a) => a.stage === s).length }));
  const bySector = Object.entries(apps.reduce<Record<string, number>>((m, a) => { m[a.industry] = (m[a.industry] ?? 0) + 1; return m; }, {}))
    .map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  // Applications received per month, last 6 months (oldest first)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const perMonth = months.map((m) => ({
    label: `${MONTHS.at(m.getMonth())} ${String(m.getFullYear()).slice(2)}`,
    count: apps.filter((a) => a.createdAt.getFullYear() === m.getFullYear() && a.createdAt.getMonth() === m.getMonth()).length,
  }));

  // Days from application to final approval
  const created = new Map(apps.map((a) => [a.id, a.createdAt]));
  const days = approvals.map((s) => (s.at.getTime() - (created.get(s.applicationId)?.getTime() ?? s.at.getTime())) / 864e5).filter((d) => d >= 0);
  const avgDaysToApproval = days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null;

  // QPR compliance for the last completed quarter
  const qprPeriod = previousPeriod(periodOf());
  const incubated = apps.filter((a) => a.status === "approved").map((a) => a.id);
  const qpr = await prisma.qprReport.findMany({ where: { period: qprPeriod, applicationId: { in: incubated } }, select: { status: true } });

  return NextResponse.json({
    totals: {
      applications: apps.length,
      incubated: incubated.length,
      published: apps.filter((a) => a.isPublic).length,
      inReview: apps.filter((a) => a.status === "pending").length,
      avgDaysToApproval,
    },
    byStage, bySector, perMonth,
    network: {
      mentorsApproved: mentors.filter((m) => m.status === "approved").length,
      investorsApproved: mentors.filter((m) => m.investorStatus === "approved").length,
      profilesPending: mentors.filter((m) => m.status === "submitted").length + mentors.filter((m) => m.investorStatus === "submitted").length,
      connectionsActive: conns.filter((c) => c.status === "active").length,
      connectionsOpen: conns.filter((c) => ["requested", "manager_approved", "routed"].includes(c.status)).length,
      sessionsHeld: sessions.filter((s) => s.status === "completed").length,
      sessionsUpcoming: sessions.filter((s) => s.status === "scheduled").length,
      avgRating: feedback.length ? Math.round((feedback.reduce((a, f) => a + f.rating, 0) / feedback.length) * 10) / 10 : null,
      ratings: feedback.length,
    },
    qpr: {
      period: qprPeriod, label: periodLabel(qprPeriod), expected: incubated.length,
      submitted: qpr.filter((r) => ["submitted", "accepted"].includes(r.status)).length,
      accepted: qpr.filter((r) => r.status === "accepted").length,
      returned: qpr.filter((r) => r.status === "returned").length,
    },
    proposals: {
      total: proposals.length,
      open: proposals.filter((p) => ["submitted", "pitch_scheduled"].includes(p.status)).length,
      invested: proposals.filter((p) => p.status === "invested").length,
    },
  });
}
