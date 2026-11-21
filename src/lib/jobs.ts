// Scheduled jobs (PRD QPR-2, REM-1, IDC-1). Server-only.
// In production a scheduler calls POST /api/cron/<job> with the CRON_SECRET header at the times
// below; Admin IT can also run any job from the admin panel. Every run is stored in JobRun.
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notify";
import { reminderPeriod, periodOf, previousPeriod, periodLabel, dueDate } from "@/lib/qpr";
import { eligibleHolders, issueCard, emailCard } from "@/lib/idcard";
import { DOC_KINDS } from "@/lib/documents";

export type JobKey = "qpr-reminders" | "profile-reminders" | "id-card-expiry";
export const JOBS: Record<JobKey, { label: string; schedule: string; cron: string; desc: string }> = {
  "qpr-reminders": { label: "Progress report reminders", schedule: "Mondays 9:00 AM during quarter-end weeks", cron: "0 9 * * 1", desc: "Reminds incubated startups that have not submitted the quarter's report (QPR-2)." },
  "profile-reminders": { label: "Incomplete profile reminders", schedule: "1st of each month, 9:00 AM", cron: "0 9 1 * *", desc: "Reminds founders with a missing application or required documents, and mentors with unfinished profiles (REM-1)." },
  "id-card-expiry": { label: "ID card expiry and renewal", schedule: "Daily, 2:00 AM", cron: "0 2 * * *", desc: "Renews expired cards of members who are still eligible and expires the rest (IDC-1)." },
};
export const JOB_KEYS = Object.keys(JOBS) as JobKey[];

async function qprReminders(trigger: "cron" | "manual") {
  const now = new Date();
  // Cron: only on a Monday inside the reminder window. Manual runs remind for the window's
  // period, or for the last completed quarter outside it.
  let period = reminderPeriod(now);
  if (trigger === "cron" && (now.getDay() !== 1 || !period)) return "Outside the reminder window: nothing sent";
  period ??= previousPeriod(periodOf(now));
  const apps = await prisma.application.findMany({
    where: { status: "approved", qprReports: { none: { period, status: { in: ["submitted", "accepted"] } } } },
    select: { userId: true },
  });
  const sent = await notifyUsers(apps.map((a) => a.userId), `Progress report due: ${periodLabel(period)}`,
    `Please submit your ${periodLabel(period)} progress report by ${dueDate(period).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`,
    "warning", undefined, { ctaPath: "/qpr", ctaLabel: "Fill in the report" });
  return `${periodLabel(period)}: ${apps.length} startup${apps.length === 1 ? "" : "s"} missing a report, ${sent} reminded`;
}

async function profileReminders() {
  const required = DOC_KINDS.filter((d) => d.required).map((d) => d.kind);
  const [noApp, missingDocs, mentorDrafts] = await Promise.all([
    prisma.user.findMany({ where: { role: "incubatee", isVerified: true, applications: { none: {} } }, select: { id: true } }),
    prisma.application.findMany({ where: { status: { not: "rejected" } }, select: { userId: true, documents: { select: { kind: true } } } }),
    prisma.user.findMany({ where: { role: "mentor", OR: [{ mentorProfile: null }, { mentorProfile: { status: { in: ["draft", "rejected"] } } }] }, select: { id: true } }),
  ]);
  const docsMissing = missingDocs.filter((a) => required.some((k) => !a.documents.some((d) => d.kind === k))).map((a) => a.userId);
  const a = await notifyUsers(noApp.map((u) => u.id), "Finish your application", "You registered but have not applied yet. The application takes about 15 minutes.", "info", undefined, { ctaPath: "/apply", ctaLabel: "Start your application" });
  const b = await notifyUsers(docsMissing, "Documents missing", "Your application is missing required documents (pitch deck or ID proof). Upload them so reviewers can assess it.", "warning", undefined, { ctaPath: "/apply", ctaLabel: "Upload documents" });
  const c = await notifyUsers(mentorDrafts.map((u) => u.id), "Complete your mentor profile", "Your mentor profile is not submitted yet. Submit it so the office can approve and list you.", "info", undefined, { ctaPath: "/mentor", ctaLabel: "Open the Mentor hub" });
  return `${a} founder${a === 1 ? "" : "s"} without an application, ${b} with missing documents, ${c} mentor${c === 1 ? "" : "s"} with unfinished profiles reminded`;
}

async function idCardExpiry() {
  const now = new Date();
  const due = await prisma.idCard.findMany({ where: { status: "active", expiresAt: { lte: now } } });
  if (!due.length) return "No cards due";
  const holders = new Map((await eligibleHolders()).map((h) => [h.userId, h]));
  let renewed = 0, expired = 0;
  for (const c of due) {
    const h = holders.get(c.userId);
    if (h) { const r = await issueCard(h); await emailCard(r.card, true); renewed++; }
    else { await prisma.idCard.update({ where: { id: c.id }, data: { status: "expired" } }); expired++; }
  }
  return `${renewed} renewed, ${expired} expired (holder no longer eligible)`;
}

/** Run a job and record it. Never throws: the failure is stored on the run. */
export async function runJob(job: JobKey, trigger: "cron" | "manual") {
  const run = await prisma.jobRun.create({ data: { job, trigger } });
  try {
    const summary = job === "qpr-reminders" ? await qprReminders(trigger) : job === "profile-reminders" ? await profileReminders() : await idCardExpiry();
    return prisma.jobRun.update({ where: { id: run.id }, data: { status: "ok", summary, finishedAt: new Date() } });
  } catch (err) {
    console.error(`[job] ${job} failed`, err);
    return prisma.jobRun.update({ where: { id: run.id }, data: { status: "failed", summary: String((err as Error)?.message ?? err).slice(0, 500), finishedAt: new Date() } });
  }
}
