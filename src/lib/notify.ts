import { prisma } from "@/lib/prisma";
import { APPROVAL_RANK, STAGES, type Stage } from "@/lib/workflow";
import { sendEventEmail } from "@/lib/email";

export type NotifyType = "info" | "success" | "warning" | "error";

/** Also email the user (PRD NOT-1). Only for key events, never for chat messages. */
export type EmailOpt = { ctaPath: string; ctaLabel?: string };

// Mail failures must never break the action that triggered them.
async function emailUsers(users: { email: string; name: string }[], title: string, message: string, type: NotifyType, email: EmailOpt) {
  // Strip emoji from the subject line (symbols block and surrogate pairs)
  const plainTitle = title.replace(/[☀-➿️]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/\s+/g, " ").trim();
  const results = await Promise.allSettled(
    users.map((u) => sendEventEmail({ to: u.email, name: u.name, title: plainTitle, message, type, ...email })),
  );
  results.forEach((r) => { if (r.status === "rejected") console.error("[email] event email failed:", r.reason); });
}

export async function notify(userId: string, title: string, message: string, type: NotifyType, applicationId?: string, email?: EmailOpt) {
  await prisma.notification.create({ data: { userId, title, message, type, applicationId: applicationId ?? null } });
  if (email) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (u) await emailUsers([u], title, message, type, email);
  }
}

/** Notify every office user whose approval rank equals `rank` (e.g. 2 = Incubation Managers). */
export async function notifyRank(rank: number, title: string, message: string, applicationId?: string, email?: EmailOpt) {
  const roles = Object.entries(APPROVAL_RANK).filter(([, r]) => r === rank).map(([role]) => role);
  const users = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true, email: true, name: true } });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, title, message, type: "info", applicationId: applicationId ?? null })),
  });
  if (email) await emailUsers(users, title, message, "info", email);
}

// Notify (and email) every office user who has authority to act on application `stage`.
export async function notifyReviewers(stage: Stage, startupName: string, applicationId: string, title = "Action Required") {
  const required = STAGES[stage].requiredRank;
  if (!required) return;
  await notifyRank(required, title, `"${startupName}" is waiting for ${STAGES[stage].label}.`, applicationId,
    { ctaPath: "/approvals", ctaLabel: "Open applications" });
}
