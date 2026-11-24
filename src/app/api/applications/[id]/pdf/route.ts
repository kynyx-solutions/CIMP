// Application as PDF with its approval trail and signatures (PRD PDF-1).
// The office copy includes reviewers' remarks; the applicant's copy shows decisions only.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { canViewApplicants, ROLE_LABELS, STAGES, type Stage } from "@/lib/workflow";
import { displayValue, valueOf } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";
import { DOC_KIND_MAP, type DocKind } from "@/lib/documents";
import { PdfBuilder, pdfResponse, BRAND, MUTED } from "@/lib/pdf";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: { steps: { orderBy: { at: "asc" } }, documents: { select: { kind: true, fileName: true } }, user: { select: { email: true } } },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const office = canViewApplicants(user.role);
  if (!office && !(user.role === "incubatee" && app.userId === user.userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await getForm("application");
  const approved = app.status === "approved";
  const pdf = await PdfBuilder.create(`Incubation application: ${app.startupName}`,
    approved ? `Approved and signed by the CEO${app.isFastTracked ? " (fast-tracked)" : ""}` : `Status: ${STAGES[app.stage as Stage]?.label ?? app.stage}`);

  pdf.fields([
    { label: "Applicant", value: `${app.applicantName} (${app.user.email})` },
    { label: "Applied on", value: app.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
    { label: "Form version", value: `v${app.formVersion ?? 0}` },
    ...(app.officeEdited ? [{ label: "Note", value: "Some details were corrected by the CIMP-BIIF office; see the audit log." }] : []),
  ]);
  for (const s of form.sections) {
    const fields = form.fields.filter((f) => f.section === s.title);
    if (!fields.length) continue;
    pdf.heading(s.title);
    pdf.fields(fields.map((f) => ({ label: f.label, value: displayValue(valueOf(app, f)) || "Not provided" })));
  }
  pdf.heading("Documents on file");
  pdf.fields(Object.values(DOC_KIND_MAP).map((d) => ({ label: d.label, value: app.documents.find((x) => x.kind === d.kind as DocKind)?.fileName ?? (d.required ? "Missing" : "Not provided") })));

  pdf.heading("Approval trail");
  if (!app.steps.length) pdf.text("No decisions yet.", { color: MUTED });
  else pdf.table(
    office ? ["Date", "Decision", "By", "Remark", "Signature"] : ["Date", "Decision", "By", "Signature"],
    app.steps.map((s) => {
      const row = [s.at.toLocaleDateString("en-IN"), s.action, `${s.actorName}\n${ROLE_LABELS[s.actorRole] ?? s.actorRole}`];
      if (office) row.push(s.remark ?? "");
      row.push(s.signature ? `Signed: ${s.signature}` : "");
      return row;
    }),
    office ? [0.13, 0.2, 0.2, 0.27, 0.2] : [0.15, 0.3, 0.3, 0.25],
  );
  // Drawn signatures (Senior Manager and CEO stages)
  const signed = app.steps.filter((s) => s.signature);
  if (signed.length) {
    pdf.heading("Signatures");
    for (const s of signed) {
      if (s.signatureImage) await pdf.image(s.signatureImage, 180, 56);
      pdf.text(`${s.signature} · ${ROLE_LABELS[s.actorRole] ?? s.actorRole} · ${s.at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} IST`, { size: 9, color: MUTED });
      pdf.gap(10);
    }
  }
  if (approved) {
    pdf.gap(14);
    pdf.text("This application has completed CIMP-BIIF's four-stage review. Signatures above were given by each reviewer in the portal and are recorded with their account, date and time in the audit log.", { size: 9, color: MUTED });
    pdf.gap(6);
    pdf.text(`Verification reference: ${app.id}`, { size: 9, bold: true, color: BRAND });
  }
  await audit(req, user, "application.pdf", "application", app.id, `Downloaded the ${office ? "office" : "applicant"} PDF of "${app.startupName}"`);
  return pdfResponse(await pdf.save(), `Application-${app.startupName}.pdf`);
}
