// Mentorship on an accepted connection (PRD MEN-4).
//   GET   ?connectionId=…                               sessions (+ feedback) and document requests
//   POST  { kind:"session", connectionId, scheduledAt, durationMin, mode, location, agenda }
//   POST  { kind:"feedback", sessionId, rating, comment }
//   POST  { kind:"doc_request", connectionId, title, note }      mentor only
//   PATCH { kind:"session", sessionId, action: complete|cancel, reason }
//   PATCH { kind:"doc_request", requestId, action: close }        mentor only
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId, str } from "@/lib/serialize";
import { mentorshipAccess, SESSION_MODES } from "@/lib/mentorship";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " IST";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!isId(connectionId)) return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  const access = await mentorshipAccess(user, connectionId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [sessions, docRequests, startup] = await Promise.all([
    prisma.mentorSession.findMany({ where: { connectionId }, include: { feedback: true }, orderBy: { scheduledAt: "desc" } }),
    prisma.docRequest.findMany({ where: { connectionId }, orderBy: { createdAt: "desc" } }),
    access.conn.applicationId ? prisma.application.findUnique({ where: { id: access.conn.applicationId }, select: { startupName: true } }) : null,
  ]);
  return NextResponse.json({
    connection: { _id: access.conn.id, mentorName: access.conn.mentor.name, menteeName: access.conn.incubatee.name, startupName: startup?.startupName ?? null, status: access.conn.status },
    role: access.isMentor ? "mentor" : access.isMentee ? "mentee" : "office",
    canAct: access.canAct,
    sessions: withId(sessions).map((s: any) => ({
      ...s,
      myFeedback: s.feedback.find((f: any) => f.authorId === user.userId) ?? null,
      // participants see each other's rating only after both have given one; the office sees all
      feedback: access.canAct && s.feedback.length < 2 ? s.feedback.filter((f: any) => f.authorId === user.userId) : s.feedback,
    })),
    docRequests: withId(docRequests).map(({ storedName, ...d }: any) => d),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.kind === "feedback") {
    if (!isId(body.sessionId)) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const s = await prisma.mentorSession.findUnique({ where: { id: body.sessionId } });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const access = await mentorshipAccess(user, s.connectionId);
    if (!access?.canAct) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (s.status !== "completed") return NextResponse.json({ error: "Feedback opens once the session is marked completed" }, { status: 400 });
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Rate the session from 1 to 5" }, { status: 400 });
    const exists = await prisma.sessionFeedback.findUnique({ where: { sessionId_authorId: { sessionId: s.id, authorId: user.userId } } });
    if (exists) return NextResponse.json({ error: "You already gave feedback for this session" }, { status: 409 });
    const fb = await prisma.sessionFeedback.create({ data: { sessionId: s.id, authorId: user.userId, authorRole: access.isMentor ? "mentor" : "mentee", rating, comment: str(body.comment, 1500) || null } });
    await audit(req, user, "session.feedback", "session", s.id, `Gave ${rating}/5 feedback on the session of ${when(s.scheduledAt)}`);
    await notify(access.other!, "Session feedback received", `${user.name} rated your session of ${when(s.scheduledAt)}.`, "info", access.conn.applicationId ?? undefined);
    return NextResponse.json({ success: true, feedback: withId(fb) }, { status: 201 });
  }

  if (!isId(body.connectionId)) return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  const access = await mentorshipAccess(user, body.connectionId);
  if (!access?.canAct) return NextResponse.json({ error: "Only the mentor and the startup of an accepted connection can do this" }, { status: 403 });
  const appId = access.conn.applicationId ?? undefined;

  if (body.kind === "session") {
    const at = new Date(String(body.scheduledAt ?? ""));
    if (Number.isNaN(at.getTime())) return NextResponse.json({ error: "Choose a date and time" }, { status: 400 });
    if (at.getTime() < Date.now() + 5 * 60_000) return NextResponse.json({ error: "Schedule the session in the future" }, { status: 400 });
    if (at.getTime() > Date.now() + 180 * 864e5) return NextResponse.json({ error: "Schedule within the next 6 months" }, { status: 400 });
    const durationMin = Number(body.durationMin ?? 60);
    if (![30, 45, 60, 90, 120].includes(durationMin)) return NextResponse.json({ error: "Choose a valid duration" }, { status: 400 });
    if (!SESSION_MODES.some((m) => m.value === body.mode)) return NextResponse.json({ error: "Choose video call or in person" }, { status: 400 });
    const location = str(body.location, 300);
    if (body.mode === "virtual" && location && !/^https:\/\/\S+\.\S+/.test(location)) return NextResponse.json({ error: "The meeting link must start with https://" }, { status: 400 });
    if (body.mode === "physical" && !location) return NextResponse.json({ error: "Give the meeting place" }, { status: 400 });
    const agenda = str(body.agenda, 1500);
    if (!agenda) return NextResponse.json({ error: "Add a short agenda" }, { status: 400 });

    const s = await prisma.mentorSession.create({ data: { connectionId: access.conn.id, scheduledAt: at, durationMin, mode: body.mode, location: location || null, agenda, createdById: user.userId } });
    await audit(req, user, "session.schedule", "session", s.id, `Scheduled a ${body.mode === "virtual" ? "video" : "in-person"} session for ${when(at)} (${durationMin} min)`);
    await notify(access.other!, "Mentorship session scheduled 📅",
      `${user.name} scheduled a ${body.mode === "virtual" ? "video call" : "meeting"} on ${when(at)} for ${durationMin} minutes.${location ? ` ${body.mode === "virtual" ? "Link" : "Place"}: ${location}.` : ""} Agenda: ${agenda}`,
      "info", appId, { ctaPath: `/mentorship/${access.conn.id}`, ctaLabel: "View the session" });
    return NextResponse.json({ success: true, session: withId(s) }, { status: 201 });
  }

  if (body.kind === "doc_request") {
    if (!access.isMentor) return NextResponse.json({ error: "Only the mentor can request documents" }, { status: 403 });
    const title = str(body.title, 120);
    if (!title) return NextResponse.json({ error: "Name the document you need" }, { status: 400 });
    const open = await prisma.docRequest.count({ where: { connectionId: access.conn.id, status: "requested" } });
    if (open >= 10) return NextResponse.json({ error: "Close some open requests first (max 10)" }, { status: 400 });
    const d = await prisma.docRequest.create({ data: { connectionId: access.conn.id, title, note: str(body.note, 1000) || null, requestedBy: user.userId } });
    await audit(req, user, "doc_request.create", "doc_request", d.id, `Requested document "${title}" from ${access.conn.incubatee.name}`);
    await notify(access.other!, "Document requested", `${user.name} asked for: ${title}.${d.note ? ` ${d.note}` : ""}`, "info", appId, { ctaPath: `/mentorship/${access.conn.id}`, ctaLabel: "Upload it" });
    return NextResponse.json({ success: true, docRequest: withId(d) }, { status: 201 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.kind === "session") {
    if (!isId(body.sessionId) || !["complete", "cancel"].includes(body.action)) return NextResponse.json({ error: "sessionId and action required" }, { status: 400 });
    const s = await prisma.mentorSession.findUnique({ where: { id: body.sessionId } });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const access = await mentorshipAccess(user, s.connectionId);
    if (!access?.canAct) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (s.status !== "scheduled") return NextResponse.json({ error: "This session is already closed" }, { status: 400 });
    if (body.action === "complete" && s.scheduledAt.getTime() > Date.now()) return NextResponse.json({ error: "A session can be marked completed once it has started" }, { status: 400 });
    const reason = str(body.reason, 500);
    if (body.action === "cancel" && !reason) return NextResponse.json({ error: "Give a reason for cancelling" }, { status: 400 });
    const status = body.action === "complete" ? "completed" : "cancelled";
    await prisma.mentorSession.update({ where: { id: s.id }, data: { status, cancelReason: reason || null } });
    await audit(req, user, `session.${body.action}`, "session", s.id, `${status === "completed" ? "Marked completed" : "Cancelled"} the session of ${when(s.scheduledAt)}${reason ? ` (reason: ${reason})` : ""}`, { status: { from: "scheduled", to: status } });
    await notify(access.other!, status === "completed" ? "Session completed: share feedback" : "Session cancelled",
      status === "completed" ? `${user.name} marked the session of ${when(s.scheduledAt)} as completed. Rate it to help CIMP-BIIF improve mentoring.` : `${user.name} cancelled the session of ${when(s.scheduledAt)}. Reason: ${reason}`,
      status === "completed" ? "success" : "warning", access.conn.applicationId ?? undefined, { ctaPath: `/mentorship/${access.conn.id}`, ctaLabel: status === "completed" ? "Give feedback" : "Reschedule" });
    return NextResponse.json({ success: true, status });
  }

  if (body.kind === "doc_request") {
    if (!isId(body.requestId) || body.action !== "close") return NextResponse.json({ error: "requestId and action required" }, { status: 400 });
    const d = await prisma.docRequest.findUnique({ where: { id: body.requestId } });
    if (!d) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    const access = await mentorshipAccess(user, d.connectionId);
    if (!access?.isMentor) return NextResponse.json({ error: "Only the mentor can close a request" }, { status: 403 });
    if (d.status === "closed") return NextResponse.json({ error: "Already closed" }, { status: 400 });
    await prisma.docRequest.update({ where: { id: d.id }, data: { status: "closed" } });
    await audit(req, user, "doc_request.close", "doc_request", d.id, `Closed document request "${d.title}"`);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
