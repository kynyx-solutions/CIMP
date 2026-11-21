// Scheduler entry point: POST /api/cron/<job> with header `x-cron-secret: $CRON_SECRET`.
// Disabled unless CRON_SECRET is set (at least 24 characters).
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { JOB_KEYS, runJob, type JobKey } from "@/lib/jobs";
import { audit } from "@/lib/audit";

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("x-cron-secret") ?? "";
  if (secret.length < 24 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
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
