// Export jobs (PRD XLS-1). Server-only. A job row is created as "queued" and processed in
// the background; the browser polls the job list. Phase 1 moves this to a worker + queue.
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { DATASETS, type DatasetKey } from "@/lib/exports";
import { saveExport } from "@/lib/storage";
import { STAGES, type Stage } from "@/lib/workflow";
import { periodLabel } from "@/lib/qpr";

type Row = Record<string, unknown>;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

async function loadRows(dataset: DatasetKey, filters: Record<string, string>): Promise<Row[]> {
  if (dataset === "applications") {
    const apps = await prisma.application.findMany({
      where: filters.status ? { status: filters.status } : {},
      include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" },
    });
    return apps.map((a) => ({ ...a, email: a.user.email, stage: STAGES[a.stage as Stage]?.label ?? a.stage, isPublic: a.isPublic ? "Yes" : "No", officeEdited: a.officeEdited ? "Yes" : "No" }));
  }
  if (dataset === "mentors") {
    const ps = await prisma.mentorProfile.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "desc" } });
    return ps.map((p) => ({ ...p, name: p.user.name, email: p.user.email, sectors: p.sectors.join(", "), isPublic: p.isPublic ? "Yes" : "No" }));
  }
  if (dataset === "connections") {
    const cs = await prisma.connection.findMany({
      include: { incubatee: { select: { name: true } }, mentor: { select: { name: true } }, sessions: { include: { feedback: true } } },
      orderBy: { createdAt: "desc" },
    });
    const apps = new Map((await prisma.application.findMany({ select: { id: true, startupName: true } })).map((a) => [a.id, a.startupName]));
    return cs.map((c) => ({
      startup: (c.applicationId && apps.get(c.applicationId)) || "", founder: c.incubatee.name, mentor: c.mentor.name, type: c.type, status: c.status,
      sessions: c.sessions.filter((s) => s.status === "completed").length,
      avgRating: avg(c.sessions.flatMap((s) => s.feedback.map((f) => f.rating))), createdAt: c.createdAt,
    }));
  }
  if (dataset === "qpr") {
    const rs = await prisma.qprReport.findMany({ include: { application: { select: { startupName: true } } }, orderBy: [{ period: "desc" }] });
    return rs.map((r) => ({ ...(r.answers as Row), startup: r.application.startupName, period: periodLabel(r.period), status: r.status, submittedAt: r.submittedAt, reviewedBy: r.reviewedBy }));
  }
  const ss = await prisma.mentorSession.findMany({
    include: { feedback: true, connection: { select: { applicationId: true, mentor: { select: { name: true } } } } }, orderBy: { scheduledAt: "desc" },
  });
  const apps = new Map((await prisma.application.findMany({ select: { id: true, startupName: true } })).map((a) => [a.id, a.startupName]));
  return ss.map((s) => ({
    startup: (s.connection.applicationId && apps.get(s.connection.applicationId)) || "", mentor: s.connection.mentor.name,
    scheduledAt: s.scheduledAt, durationMin: s.durationMin, mode: s.mode === "virtual" ? "Video call" : "In person", status: s.status, agenda: s.agenda,
    mentorRating: s.feedback.find((f) => f.authorRole === "mentor")?.rating ?? null,
    founderRating: s.feedback.find((f) => f.authorRole === "mentee")?.rating ?? null,
  }));
}

function cell(v: unknown): ExcelJS.CellValue {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.join(", ");
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // never let a cell start a formula
}

export async function runExportJob(jobId: string) {
  const job = await prisma.exportJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "queued") return;
  await prisma.exportJob.update({ where: { id: job.id }, data: { status: "running" } });
  try {
    const def = DATASETS[job.dataset as DatasetKey];
    const cols = def.columns.filter((c) => job.columns.includes(c.key));
    const rows = await loadRows(job.dataset as DatasetKey, (job.filters as Record<string, string>) ?? {});

    const wb = new ExcelJS.Workbook();
    wb.creator = "CIMP-BIIF portal"; wb.created = new Date();
    const ws = wb.addWorksheet(def.label.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: Math.min(48, Math.max(12, c.label.length + 4)) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F7A16" } };
    for (const r of rows) ws.addRow(Object.fromEntries(cols.map((c) => [c.key, cell(r[c.key])])));
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (rows.some((r) => r[c.key] instanceof Date)) { col.numFmt = "dd-mmm-yyyy"; col.width = 14; }
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, cols.length) } };
    const info = wb.addWorksheet("About");
    info.addRows([["Dataset", def.label], ["Rows", rows.length], ["Generated", new Date()], ["Requested by", job.requestedBy], ["Note", "Contains personal data. Share only inside CIMP-BIIF."]]);
    info.getColumn(1).font = { bold: true }; info.getColumn(1).width = 16; info.getColumn(2).width = 60;

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const storedName = await saveExport(buf);
    await prisma.exportJob.update({ where: { id: job.id }, data: { status: "done", rowCount: rows.length, storedName, finishedAt: new Date() } });
  } catch (err) {
    console.error("[export] job failed", job.id, err);
    await prisma.exportJob.update({ where: { id: job.id }, data: { status: "failed", error: String((err as Error)?.message ?? err).slice(0, 500), finishedAt: new Date() } });
  }
}
