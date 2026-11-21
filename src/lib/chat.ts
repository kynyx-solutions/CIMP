// Who can read / post in which conversation (PRD MSG-1, MSG-2). Server-only.
//
//   application   incubatee (owner) ↔ office            stored in Message
//   connection    incubatee ↔ mentor, once active       stored in ChatMessage, office can read (oversight)
//   mentor_office mentor/investor ↔ incubation office    stored in ChatMessage, threadId = mentor's user id
import { prisma } from "@/lib/prisma";
import { APPROVAL_RANK, isOfficeRole, ROLE_LABELS } from "@/lib/workflow";
import { MENTOR_REVIEW_RANK } from "@/lib/network";
import { notify, notifyRank } from "@/lib/notify";

export type ThreadType = "application" | "connection" | "mentor_office";
export const THREAD_TYPES: ThreadType[] = ["application", "connection", "mentor_office"];

type SessionUser = { userId: string; name: string; role: string };

export type ThreadAccess = {
  canRead: boolean;
  canPost: boolean;
  /** shown above the composer, e.g. why posting is closed or who else can see the thread */
  notice?: string;
  /** user ids to notify when this user posts, and how to describe the thread to them */
  recipients: string[];
  officeRanks?: number[]; // also notify office users with these approval ranks
  label: string;
  applicationId?: string;
};

const NONE: ThreadAccess = { canRead: false, canPost: false, recipients: [], label: "" };

/** Office users who manage the mentor network (Incubation Manager and above). */
export function isNetworkOffice(role: string) {
  return (APPROVAL_RANK[role] ?? 0) >= MENTOR_REVIEW_RANK;
}

export async function threadAccess(user: SessionUser, type: ThreadType, id: string): Promise<ThreadAccess> {
  const office = isOfficeRole(user.role);

  if (type === "application") {
    const app = await prisma.application.findUnique({ where: { id }, select: { id: true, userId: true, startupName: true } });
    if (!app) return NONE;
    const owner = user.role === "incubatee" && app.userId === user.userId;
    if (!owner && !office) return NONE;
    return owner
      ? { canRead: true, canPost: true, recipients: [], officeRanks: [1, 2], label: app.startupName, applicationId: app.id }
      : { canRead: true, canPost: true, recipients: [app.userId], label: app.startupName, applicationId: app.id };
  }

  if (type === "connection") {
    const c = await prisma.connection.findUnique({
      where: { id },
      select: { id: true, status: true, incubateeId: true, mentorId: true, applicationId: true, mentor: { select: { name: true } }, incubatee: { select: { name: true } } },
    });
    if (!c) return NONE;
    const isIncubatee = user.userId === c.incubateeId;
    const isMentor = user.userId === c.mentorId;
    if (!isIncubatee && !isMentor && !office) return NONE;
    // Mentors only ever see a request once the office routes it to them
    if (isMentor && !["routed", "active", "declined"].includes(c.status)) return NONE;
    const open = c.status === "active";
    const participant = isIncubatee || isMentor;
    return {
      canRead: true,
      canPost: participant && open,
      notice: !participant
        ? "Read-only: the office can view mentor conversations for oversight."
        : !open
          ? "Messaging opens once the mentor accepts the connection."
          : "This conversation is also visible to the CIMP-BIIF office.",
      recipients: isIncubatee ? [c.mentorId] : isMentor ? [c.incubateeId] : [],
      label: isIncubatee ? c.mentor.name : c.incubatee.name,
      applicationId: c.applicationId ?? undefined,
    };
  }

  if (type === "mentor_office") {
    const mentor = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true } });
    if (!mentor || mentor.role !== "mentor") return NONE;
    if (user.userId === mentor.id)
      return { canRead: true, canPost: true, recipients: [], officeRanks: [MENTOR_REVIEW_RANK], label: "CIMP-BIIF office" };
    if (office && isNetworkOffice(user.role))
      return { canRead: true, canPost: true, recipients: [mentor.id], label: mentor.name };
    return NONE;
  }

  return NONE;
}

/** In-app notification for the other side of a conversation. */
export async function notifyNewMessage(user: SessionUser, access: ThreadAccess, type: ThreadType) {
  const from = isOfficeRole(user.role) ? `${user.name} (${ROLE_LABELS[user.role] ?? user.role})` : user.name;
  const what = type === "application" ? ` about "${access.label}"` : "";
  const title = "New message";
  const text = `${from} sent you a message${what}.`;
  await Promise.all(access.recipients.map((id) => notify(id, title, text, "info", access.applicationId)));
  for (const rank of access.officeRanks ?? []) await notifyRank(rank, title, `${from} sent a message${what}.`, access.applicationId);
}
