import { prisma } from "@/lib/prisma";
import { APPROVAL_RANK, STAGES, type Stage } from "@/lib/workflow";
import { sendEventEmail, type MailAttachment } from "@/lib/email";

export type NotifyType = "info" | "success" | "warning" | "error";

/** Also email the user (PRD NOT-1). Only for key events, never for chat messages. */
export type EmailOpt = { ctaPath: string; ctaLabel?: string; attachments?: MailAttachment[] };

import { DEDUP_MINUTES } from "@/lib/notify-shared";
export { DEDUP_MINUTES };

async function recentDuplicates(userIds: string[], title: string, message: string): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const since = new Date(Date.now() - DEDUP_MINUTES * 60_000);
  const rows = await prisma.notification.findMany({
    where: { userId: { in: userIds }, title, message, createdAt: { gte: since } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

// Mail providers cap the send rate (Resend: 2 per second by default), so a broadcast to many
// people goes out at MAIL_RATE_PER_SEC instead of all at once. Raise it on a paid plan.
const MAIL_RATE = Math.max(1, Number(process.env.MAIL_RATE_PER_SEC) || 2);
/** Most people one request can email within the 5-minute function limit. */
export const MAX_EMAIL_RECIPIENTS = MAIL_RATE * 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mail failures must never break the action that triggered them.
async function emailUsers(users: { email: string; name: string }[], title: string, message: string, type: NotifyType, email: EmailOpt) {
  // Strip emoji from the subject line (symbols block and surrogate pairs)
  const plainTitle = title.replace(/[☀-➿️]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/\s+/g, " ").trim();
  const send = (u: { email: string; name: string }) =>
    sendEventEmail({ to: u.email, name: u.name, title: plainTitle, message, type, ...email })
      .catch((err) => console.error("[email] event email failed:", err));
  // MAIL_RATE workers, each sending at most one email per second
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(MAIL_RATE, users.length) }, async () => {
    while (next < users.length) {
      const u = users[next++];
      await Promise.all([send(u), next < users.length ? sleep(1000) : null]);
    }
  }));
}

/**
 * Notify a list of users (in-app, and by email when `email` is given), skipping anyone who got
 * the same notification within the dedup window. Returns how many were actually notified.
 */
export async function notifyUsers(userIds: string[], title: string, message: string, type: NotifyType, applicationId?: string, email?: EmailOpt): Promise<number> {
  const dupes = await recentDuplicates(userIds, title, message);
  const targets = Array.from(new Set(userIds)).filter((id) => !dupes.has(id));
  if (!targets.length) return 0;
  await prisma.notification.createMany({
    data: targets.map((userId) => ({ userId, title, message, type, applicationId: applicationId ?? null })),
  });
  if (email) {
    const users = await prisma.user.findMany({ where: { id: { in: targets } }, select: { email: true, name: true } });
    await emailUsers(users, title, message, type, email);
  }
  return targets.length;
}

export async function notify(userId: string, title: string, message: string, type: NotifyType, applicationId?: string, email?: EmailOpt) {
  await notifyUsers([userId], title, message, type, applicationId, email);
}

/** Notify every office user whose approval rank equals `rank` (e.g. 2 = Incubation Managers). */
export async function notifyRank(rank: number, title: string, message: string, applicationId?: string, email?: EmailOpt) {
  const roles = Object.entries(APPROVAL_RANK).filter(([, r]) => r === rank).map(([role]) => role);
  const users = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
  await notifyUsers(users.map((u) => u.id), title, message, "info", applicationId, email);
}

// Notify (and email) every office user who has authority to act on application `stage`.
export async function notifyReviewers(stage: Stage, startupName: string, applicationId: string, title = "Action Required") {
  const required = STAGES[stage].requiredRank;
  if (!required) return;
  await notifyRank(required, title, `"${startupName}" is waiting for ${STAGES[stage].label}.`, applicationId,
    { ctaPath: "/approvals", ctaLabel: "Open applications" });
}
