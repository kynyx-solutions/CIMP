// Quarterly progress reports (PRD QPR-1).
//   GET  ?period=2026-Q4           incubatee: own reports; office: every incubated startup's status for the period
//   PUT  { period, answers, submit }  incubatee saves a draft or submits
//   POST { reportId, decision: accept|return, note }  office review (Executive and above)
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { APPROVAL_RANK, isOfficeRole, ROLE_LABELS } from "@/lib/workflow";
import { validateFields } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";
import { fileablePeriods, parsePeriod, periodLabel, periodOf } from "@/lib/qpr";
import { notify, notifyRank } from "@/lib/notify";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const period = req.nextUrl.searchParams.get("period") || periodOf();
  if (!parsePeriod(period)) return NextResponse.json({ error: "Invalid period" }, { status: 400 });

  if (user.role === "incubatee") {
    const app = await prisma.application.findFirst({ where: { userId: user.userId }, select: { id: true, startupName: true, status: true } });
    const reports = app ? await prisma.qprReport.findMany({ where: { applicationId: app.id }, orderBy: { period: "desc" } }) : [];
    return NextResponse.json({ application: app, eligible: app?.status === "approved", fileable: fileablePeriods(), reports: withId(reports) });
  }
  if (!isOfficeRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Office: one row per incubated startup for the period, including those with no report yet
  const apps = await prisma.application.findMany({
    where: { status: "approved" },
    select: { id: true, startupName: true, applicantName: true, industry: true, qprReports: { where: { period } } },
    orderBy: { startupName: "asc" },
  });
  const rows = apps.map((a) => ({ applicationId: a.id, startupName: a.startupName, applicantName: a.applicantName, industry: a.industry, report: a.qprReports[0] ? withId(a.qprReports[0]) : null }));
  return NextResponse.json({ period, rows, canReview: (APPROVAL_RANK[user.role] ?? 0) >= 1 });
}

export async function PUT(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || user.role !== "incubatee") return NextResponse.json({ error: "Only incubatees file progress reports" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const period = String(body.period ?? "");
  if (!fileablePeriods().includes(period)) return NextResponse.json({ error: "You can file for the current or the previous quarter only" }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { userId: user.userId, status: "approved" }, select: { id: true, startupName: true } });
  if (!app) return NextResponse.json({ error: "Progress reports start once your application is approved" }, { status: 403 });

  const existing = await prisma.qprReport.findUnique({ where: { applicationId_period: { applicationId: app.id, period } } });
  if (existing && ["submitted", "accepted"].includes(existing.status))
    return NextResponse.json({ error: "This report is already submitted" }, { status: 400 });

  const submit = body.submit === true;
  const form = await getForm("qpr");
  // A draft may be incomplete; a submission must pass every rule
  const fields = submit ? form.fields : form.fields.map((f) => ({ ...f, required: false }));
  const parsed = validateFields(fields, body.answers && typeof body.answers === "object" ? body.answers : {});
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const data = {
    answers: parsed.data as Prisma.InputJsonValue, formVersion: form.version,
    status: submit ? "submitted" : "draft",
    ...(submit ? { submittedAt: new Date() } : {}),
  };
  const report = await prisma.qprReport.upsert({
    where: { applicationId_period: { applicationId: app.id, period } },
    create: { applicationId: app.id, period, ...data },
    update: data,
  });
  await audit(req, user, submit ? "qpr.submit" : "qpr.save", "qpr", report.id,
    `${submit ? "Submitted" : "Saved draft of"} progress report ${periodLabel(period)} for "${app.startupName}"`);
  if (submit) {
    await notify(user.userId, "Progress report submitted", `Your ${periodLabel(period)} report for "${app.startupName}" is with the incubation team.`, "success", app.id);
    await notifyRank(1, "Progress report to review", `"${app.startupName}" submitted its ${periodLabel(period)} report.`, app.id, { ctaPath: "/qpr", ctaLabel: "Review reports" });
  }
  return NextResponse.json({ success: true, report: withId(report) });
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || (APPROVAL_RANK[user.role] ?? 0) < 1) return NextResponse.json({ error: "Executive or above reviews progress reports" }, { status: 403 });
  const { reportId, decision, note } = await req.json().catch(() => ({}));
  if (!isId(reportId) || !["accept", "return"].includes(decision)) return NextResponse.json({ error: "reportId and decision are required" }, { status: 400 });
  const cleanNote = typeof note === "string" ? note.trim().slice(0, 1000) : "";
  if (decision === "return" && !cleanNote) return NextResponse.json({ error: "Tell the startup what to change" }, { status: 400 });

  const report = await prisma.qprReport.findUnique({ where: { id: reportId }, include: { application: { select: { id: true, userId: true, startupName: true } } } });
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (report.status !== "submitted") return NextResponse.json({ error: "Only submitted reports can be reviewed" }, { status: 400 });

  const status = decision === "accept" ? "accepted" : "returned";
  await prisma.qprReport.update({ where: { id: report.id }, data: { status, reviewNote: cleanNote || null, reviewedBy: user.name, reviewedAt: new Date() } });
  const label = periodLabel(report.period);
  await audit(req, user, `qpr.${decision}`, "qpr", report.id,
    `${ROLE_LABELS[user.role] ?? user.role}: ${decision === "accept" ? "accepted" : "returned"} ${label} report of "${report.application.startupName}"${cleanNote ? ` (note: ${cleanNote})` : ""}`,
    { status: { from: "submitted", to: status } });
  await notify(report.application.userId,
    decision === "accept" ? "Progress report accepted" : "Progress report needs changes",
    decision === "accept" ? `Your ${label} report was accepted.${cleanNote ? ` Note: ${cleanNote}` : ""}` : `Please update your ${label} report: ${cleanNote}`,
    decision === "accept" ? "success" : "warning", report.application.id, { ctaPath: "/qpr", ctaLabel: "Open progress reports" });
  return NextResponse.json({ success: true, status });
}
