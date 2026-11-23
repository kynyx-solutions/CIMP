// Excel export jobs (PRD XLS-1, RBAC-5).
//   GET                                   your recent jobs (poll while one is running)
//   POST { dataset, columns, filters }    queue a job; it runs in the background (on Vercel, before replying)
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId } from "@/lib/serialize";
import { DATASETS, DATASET_KEYS, REPORT_ROLES, type DatasetKey } from "@/lib/exports";
import { runExportJob } from "@/lib/exports-server";
import { audit } from "@/lib/audit";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !REPORT_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Without the in-app scheduler (Vercel), clear exports stuck in "running" here instead
  await prisma.exportJob.updateMany({
    where: { requestedById: user.userId, status: { in: ["queued", "running"] }, createdAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "failed", error: "Timed out", finishedAt: new Date() },
  });
  const jobs = await prisma.exportJob.findMany({ where: { requestedById: user.userId }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ jobs: withId(jobs).map(({ storedName, ...j }: any) => ({ ...j, ready: !!storedName })) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !REPORT_ROLES.includes(user.role)) return NextResponse.json({ error: "Your role cannot export data" }, { status: 403 });
  const { dataset, columns, filters } = await req.json().catch(() => ({}));
  if (!DATASET_KEYS.includes(dataset)) return NextResponse.json({ error: "Choose a dataset" }, { status: 400 });
  const def = DATASETS[dataset as DatasetKey];
  const cols = Array.isArray(columns) ? def.columns.map((c) => c.key).filter((k) => columns.includes(k)) : [];
  if (!cols.length) return NextResponse.json({ error: "Choose at least one column" }, { status: 400 });
  const cleanFilters: Record<string, string> = {};
  for (const f of def.filters ?? []) {
    const v = filters?.[f.key];
    if (typeof v === "string" && f.options.includes(v)) cleanFilters[f.key] = v;
  }
  const running = await prisma.exportJob.count({ where: { requestedById: user.userId, status: { in: ["queued", "running"] } } });
  if (running >= 3) return NextResponse.json({ error: "Wait for your running exports to finish" }, { status: 429 });

  const job = await prisma.exportJob.create({
    data: { requestedById: user.userId, requestedBy: user.name, dataset, columns: cols, filters: cleanFilters as Prisma.InputJsonValue },
  });
  await audit(req, user, "export.request", "export", job.id, `Requested an Excel export of ${def.label} (${cols.length} columns${Object.keys(cleanFilters).length ? `, ${JSON.stringify(cleanFilters)}` : ""})`);
  // On a long-running server the export runs in the background and the client polls GET.
  // On Vercel the function is frozen once the response is sent, so finish the export first.
  if (process.env.VERCEL) {
    await runExportJob(job.id);
    const { storedName, ...done } = (await prisma.exportJob.findUnique({ where: { id: job.id } })) ?? job;
    return NextResponse.json({ success: true, job: { ...withId(done), ready: !!storedName } }, { status: 202 });
  }
  void runExportJob(job.id);
  return NextResponse.json({ success: true, job: withId(job) }, { status: 202 });
}
