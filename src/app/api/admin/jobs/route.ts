// Scheduled jobs in the admin panel: list with recent runs; run one now (Admin IT, CEO).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { JOBS, JOB_KEYS, runJob, type JobKey } from "@/lib/jobs";
import { audit } from "@/lib/audit";
import { schedulerStatus } from "@/lib/scheduler";

const ALLOWED = ["admin_it", "ceo"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const jobs = await Promise.all(JOB_KEYS.map(async (key) => ({
    key, ...JOBS[key],
    runs: await prisma.jobRun.findMany({ where: { job: key }, orderBy: { startedAt: "desc" }, take: 5 }),
  })));
  return NextResponse.json({ jobs, scheduler: schedulerStatus(), externalCron: (process.env.CRON_SECRET ?? "").length >= 24 });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { job } = await req.json().catch(() => ({}));
  if (!JOB_KEYS.includes(job)) return NextResponse.json({ error: "Unknown job" }, { status: 400 });
  const recent = await prisma.jobRun.findFirst({ where: { job, status: "running", startedAt: { gte: new Date(Date.now() - 5 * 60_000) } } });
  if (recent) return NextResponse.json({ error: "This job is already running" }, { status: 409 });
  const run = (await runJob(job as JobKey, "manual"))!;
  await audit(req, user, "job.run", "job", run.id, `Ran "${JOBS[job as JobKey].label}" manually: ${run.status}${run.summary ? ` — ${run.summary}` : ""}`);
  return NextResponse.json({ run });
}
