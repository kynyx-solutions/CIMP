// In-app scheduler (PRD QPR-2, REM-1, IDC-1, XLS-1). Started once per server process from
// src/instrumentation.ts. Every 30 seconds it:
//   1. runs any job whose cron time has come (each slot runs once: JobRun has a unique
//      (job, slot) key, so several servers or overlapping ticks cannot double-run it);
//   2. processes queued Excel exports (the export "processor" polling every 30 s);
//   3. marks exports stuck in "running" for over 10 minutes as failed.
// Set SCHEDULER_ENABLED=false to switch it off (e.g. when an external cron calls /api/cron).
import { prisma } from "@/lib/prisma";
import { cronMatches, istParts, nextRun } from "@/lib/cron";
import { JOBS, JOB_KEYS, runJob } from "@/lib/jobs";
import { runExportJob } from "@/lib/exports-server";
import { audit } from "@/lib/audit";

const TICK_MS = 30_000;

type State = { startedAt: Date; lastTick: Date | null; ticks: number; timer: ReturnType<typeof setInterval> | null; busy: boolean };
const g = globalThis as unknown as { __cimpScheduler?: State };

export function schedulerEnabled() {
  return process.env.SCHEDULER_ENABLED !== "false";
}

export function schedulerStatus() {
  const s = g.__cimpScheduler;
  return {
    enabled: schedulerEnabled(),
    running: !!s?.timer,
    startedAt: s?.startedAt ?? null,
    lastTick: s?.lastTick ?? null,
    next: Object.fromEntries(JOB_KEYS.map((k) => [k, nextRun(JOBS[k].cron)?.toISOString() ?? null])),
  };
}

async function tick() {
  const s = g.__cimpScheduler!;
  if (s.busy) return; // a slow tick is still running
  s.busy = true;
  try {
    s.lastTick = new Date(); s.ticks++;
    const now = istParts();
    for (const job of JOB_KEYS) {
      if (!cronMatches(JOBS[job].cron, now)) continue;
      const run = await runJob(job, "cron", now.key); // null if the slot already ran
      if (run) await audit(null, null, "job.run", "job", run.id, `Scheduled run of "${JOBS[job].label}" (${now.key}): ${run.status}${run.summary ? ` — ${run.summary}` : ""}`);
    }
    // Export processor
    const queued = await prisma.exportJob.findMany({ where: { status: "queued" }, select: { id: true }, orderBy: { createdAt: "asc" }, take: 5 });
    for (const j of queued) await runExportJob(j.id);
    await prisma.exportJob.updateMany({
      where: { status: "running", createdAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      data: { status: "failed", error: "Timed out", finishedAt: new Date() },
    });
  } catch (err) {
    console.error("[scheduler] tick failed", err);
  } finally {
    s.busy = false;
  }
}

export function startScheduler() {
  if (!schedulerEnabled() || g.__cimpScheduler?.timer) return;
  g.__cimpScheduler = { startedAt: new Date(), lastTick: null, ticks: 0, timer: null, busy: false };
  g.__cimpScheduler.timer = setInterval(() => { void tick(); }, TICK_MS);
  // let the server finish booting before the first tick
  setTimeout(() => { void tick(); }, 5_000);
  console.log(`[scheduler] started: ${JOB_KEYS.map((k) => `${k} (${JOBS[k].cron} IST)`).join(", ")}; exports polled every ${TICK_MS / 1000}s`);
}
