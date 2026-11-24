// QPR as PDF (PRD PDF-1): the startup and the office.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { canViewApplicants } from "@/lib/workflow";
import { displayValue, type AnswerValue } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";
import { periodLabel, QPR_STATUS } from "@/lib/qpr";
import { PdfBuilder, pdfResponse } from "@/lib/pdf";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await prisma.qprReport.findUnique({
    where: { id: params.id },
    include: { application: { select: { userId: true, startupName: true, applicantName: true, industry: true, city: true, state: true } } },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewApplicants(user.role) && !(user.role === "incubatee" && r.application.userId === user.userId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await getForm("qpr");
  const answers = (r.answers ?? {}) as Record<string, AnswerValue>;
  const pdf = await PdfBuilder.create(`Quarterly progress report: ${r.application.startupName}`, periodLabel(r.period));
  pdf.fields([
    { label: "Startup", value: r.application.startupName },
    { label: "Founder", value: r.application.applicantName },
    { label: "Sector", value: r.application.industry },
    { label: "Location", value: [r.application.city, r.application.state].filter(Boolean).join(", ") },
    { label: "Status", value: QPR_STATUS[r.status]?.label ?? r.status },
    { label: "Submitted", value: r.submittedAt ? r.submittedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "Not yet" },
    ...(r.reviewedBy ? [{ label: "Reviewed by", value: `${r.reviewedBy}${r.reviewedAt ? `, ${r.reviewedAt.toLocaleDateString("en-IN")}` : ""}${r.reviewNote ? ` — ${r.reviewNote}` : ""}` }] : []),
  ]);
  for (const s of form.sections) {
    const fields = form.fields.filter((f) => f.section === s.title);
    if (!fields.length) continue;
    pdf.heading(s.title);
    pdf.fields(fields.map((f) => {
      const v = answers[f.key];
      const shown = typeof v === "number" && /₹/.test(f.label) ? `₹${v.toLocaleString("en-IN")}` : displayValue(v);
      return { label: f.label, value: shown || "Not answered" };
    }));
  }
  // Answers to questions removed from the form since are still part of the record
  const known = new Set(form.fields.map((f) => f.key));
  const extra = Object.entries(answers).filter(([k, v]) => !known.has(k) && displayValue(v));
  if (extra.length) { pdf.heading("Other answers (earlier form version)"); pdf.fields(extra.map(([k, v]) => ({ label: k, value: displayValue(v) }))); }

  return pdfResponse(await pdf.save(), `QPR-${r.application.startupName}-${r.period}.pdf`);
}
