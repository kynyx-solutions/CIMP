// Mentorship on an accepted connection (PRD MEN-4): sessions, document requests, feedback.
// Server-only access rules shared by the session and document-request routes.
import { prisma } from "@/lib/prisma";
import { isOfficeRole } from "@/lib/workflow";

export type MentorshipAccess = {
  conn: { id: string; incubateeId: string; mentorId: string; status: string; applicationId: string | null; mentor: { name: string }; incubatee: { name: string } };
  isMentor: boolean;
  isMentee: boolean;
  /** participants act; the office only reads (oversight) */
  canAct: boolean;
  other: string | null; // the other participant's user id
};

export async function mentorshipAccess(user: { userId: string; role: string }, connectionId: string): Promise<MentorshipAccess | null> {
  const conn = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: { id: true, incubateeId: true, mentorId: true, status: true, applicationId: true, mentor: { select: { name: true } }, incubatee: { select: { name: true } } },
  });
  if (!conn) return null;
  const isMentor = user.userId === conn.mentorId, isMentee = user.userId === conn.incubateeId;
  if (!isMentor && !isMentee && !isOfficeRole(user.role)) return null;
  if ((isMentor || isMentee) && conn.status !== "active") return null; // only accepted connections have a mentorship
  return { conn, isMentor, isMentee, canAct: (isMentor || isMentee) && conn.status === "active", other: isMentor ? conn.incubateeId : isMentee ? conn.mentorId : null };
}

export const SESSION_MODES = [
  { value: "virtual", label: "Video call" },
  { value: "physical", label: "In person" },
] as const;

export const DOC_REQUEST_TYPES = ["pdf", "jpg", "png", "pptx", "ppt"] as const;
export const DOC_REQUEST_MAX = 4 * 1024 * 1024; // hosting limit: request bodies over 4.5 MB are rejected before the app
