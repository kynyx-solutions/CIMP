// Scheduler entry point for external schedulers. Disabled unless CRON_SECRET is set (24+ characters).
//   POST /api/cron/<job> with header `x-cron-secret: $CRON_SECRET`: any cron; the minute is the slot.
//   GET  /api/cron/<job> with header `Authorization: Bearer $CRON_SECRET`: Vercel Cron (vercel.json).
//        Vercel may fire anywhere within the scheduled hour, so the IST day is the slot: one run per day.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { JOB_KEYS, runJob, type JobKey } from "@/lib/jobs";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function matches(given: string) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

function authorised(req: NextRequest) {
  return matches(req.headers.get("x-cron-secret") ?? "");
}

export async function GET(req: NextRequest, { params }: { params: { job: string } }) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Scheduler not configured" }, { status: 503 });
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!matches(bearer)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!JOB_KEYS.includes(params.job as JobKey)) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  const { istParts } = await import("@/lib/cron");
  const slot = `${istParts().key.slice(0, 10)} IST (daily)`;
  const run = await runJob(params.job as JobKey, "cron", slot);
  if (!run) return NextResponse.json({ status: "skipped", summary: "Already ran today" });
  await audit(req, null, "job.run", "job", run.id, `Scheduled run of ${params.job}: ${run.status}${run.summary ? ` — ${run.summary}` : ""}`);
  return NextResponse.json({ status: run.status, summary: run.summary });
}

export async function POST(req: NextRequest, { params }: { params: { job: string } }) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Scheduler not configured" }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!JOB_KEYS.includes(params.job as JobKey)) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  // External schedulers call this at the job's time; the minute is the slot, so retries do not double-run
  const { istParts } = await import("@/lib/cron");
  const run = await runJob(params.job as JobKey, "cron", istParts().key);
  if (!run) return NextResponse.json({ status: "skipped", summary: "This slot already ran" });
  await audit(req, null, "job.run", "job", run.id, `Scheduled run of ${params.job}: ${run.status}${run.summary ? ` — ${run.summary}` : ""}`);
  return NextResponse.json({ status: run.status, summary: run.summary });
}
