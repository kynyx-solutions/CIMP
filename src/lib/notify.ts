import { prisma } from "@/lib/prisma";
import { APPROVAL_RANK, STAGES, type Stage } from "@/lib/workflow";

export type NotifyType = "info" | "success" | "warning" | "error";

export async function notify(userId: string, title: string, message: string, type: NotifyType, applicationId: string) {
  await prisma.notification.create({ data: { userId, title, message, type, applicationId } });
}

// Notify every office user who has authority to act on `stage`.
export async function notifyReviewers(stage: Stage, startupName: string, applicationId: string, title = "Action Required") {
  const required = STAGES[stage].requiredRank;
  if (!required) return;
  const roles = Object.entries(APPROVAL_RANK).filter(([, r]) => r === required).map(([role]) => role);
  const reviewers = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });
  if (reviewers.length === 0) return;
  await prisma.notification.createMany({
    data: reviewers.map((r) => ({
      userId: r.id, title, type: "info", applicationId,
      message: `"${startupName}" is waiting for ${STAGES[stage].label}.`,
    })),
  });
}
