// Incubatee ↔ mentor/investor connection requests (PRD MEN-3, workflow 6.3).
// Incubatee requests → Incubation Manager review → Sr. Manager routes → mentor accepts/declines.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { canViewApplicants, ROLE_LABELS } from "@/lib/workflow";
import { CONN_STAGES, canActOnConnection, type ConnAction, type ConnStatus } from "@/lib/network";
import { notify, notifyRank } from "@/lib/notify";
import { audit } from "@/lib/audit";

const OPEN: ConnStatus[] = ["requested", "manager_approved", "routed", "active"];

// GET — scoped by role
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where =
    user.role === "incubatee" ? { incubateeId: user.userId }
    : user.role === "mentor" ? { mentorId: user.userId, status: { in: ["routed", "active", "declined"] } }
    : canViewApplicants(user.role) ? {}
    : null;
  if (!where) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connections = await prisma.connection.findMany({
    where,
    include: {
      incubatee: { select: { id: true, name: true } },
      mentor: { select: { id: true, name: true, mentorProfile: { select: { headline: true, investorStatus: true } } } },
      steps: { orderBy: { at: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Startup names for context
  const appIds = connections.map((c) => c.applicationId).filter((x): x is string => !!x);
  const apps = await prisma.application.findMany({ where: { id: { in: appIds } }, select: { id: true, startupName: true, industry: true } });
  const appById = new Map(apps.map((a) => [a.id, a]));

  const visible = connections.map((c) => ({
    ...c,
    startup: c.applicationId ? appById.get(c.applicationId) ?? null : null,
    // Office remarks stay internal; incubatees and mentors see the decision trail without them
    steps: canViewApplicants(user.role) ? c.steps : c.steps.map(({ remark, ...s }) => s),
  }));
  return NextResponse.json({ connections: withId(visible) });
}

// POST — incubatee requests a connection: { mentorId, type, message }
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "incubatee") return NextResponse.json({ error: "Only incubatees can request connections" }, { status: 403 });

  const { mentorId, type, message } = await req.json();
  const text = typeof message === "string" ? message.trim().slice(0, 1500) : "";
  if (!isId(mentorId) || !["mentorship", "investment"].includes(type) || !text)
    return NextResponse.json({ error: "Choose a mentor, the type of help, and add a short message" }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { userId: user.userId, status: "approved" } });
  if (!app) return NextResponse.json({ error: "Connections open once your application is approved" }, { status: 403 });

  const profile = await prisma.mentorProfile.findUnique({ where: { userId: mentorId } });
  if (!profile || profile.status !== "approved") return NextResponse.json({ error: "Mentor not available" }, { status: 404 });
  if (type === "investment" && profile.investorStatus !== "approved")
    return NextResponse.json({ error: "This mentor is not listed as an investor" }, { status: 400 });

  const dup = await prisma.connection.findFirst({ where: { incubateeId: user.userId, mentorId, status: { in: OPEN } } });
  if (dup) return NextResponse.json({ error: "You already have an open request with this mentor" }, { status: 409 });

  const connection = await prisma.connection.create({
    data: {
      incubateeId: user.userId, mentorId, applicationId: app.id, type, message: text, status: "requested",
      steps: { create: { fromStatus: "new", toStatus: "requested", action: "requested connection", actorId: user.userId, actorName: user.name, actorRole: user.role } },
    },
  });
  await notifyRank(CONN_STAGES.requested.requiredRank!, "New connection request", `"${app.startupName}" asked to connect with a mentor.`, app.id, { ctaPath: "/network", ctaLabel: "Review the request" });
  await audit(req, user, "connection.request", "connection", connection.id, `Requested ${type} connection for "${app.startupName}" with ${profile.headline}`);
  return NextResponse.json({ success: true, connection: withId(connection) }, { status: 201 });
}

// PATCH — move a connection along: { connectionId, action: approve|reject|accept|decline, remark }
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId, action, remark } = await req.json();
  if (!isId(connectionId) || !["approve", "reject", "accept", "decline"].includes(action))
    return NextResponse.json({ error: "connectionId and action are required" }, { status: 400 });
  const note = typeof remark === "string" ? remark.trim().slice(0, 1000) : "";

  const conn = await prisma.connection.findUnique({ where: { id: connectionId } });
  if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  if (!canActOnConnection(user, conn, action as ConnAction))
    return NextResponse.json({ error: "You cannot do this at the current stage" }, { status: 403 });
  if (action === "reject" && !note) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  const from = conn.status as ConnStatus;
  const to: ConnStatus =
    action === "approve" ? CONN_STAGES[from].next!
    : action === "reject" ? "rejected"
    : action === "accept" ? "active"
    : "declined";
  const label = action === "approve" ? CONN_STAGES[from].actionLabel! : action === "reject" ? "not approved" : action === "accept" ? "accepted" : "declined";

  await prisma.connection.update({
    where: { id: conn.id },
    data: {
      status: to,
      steps: { create: { fromStatus: from, toStatus: to, action: label, actorId: user.userId, actorName: user.name, actorRole: user.role, remark: note || null } },
    },
  });

  const who = `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`;
  const appId = conn.applicationId ?? undefined;
  if (to === "manager_approved") {
    await notify(conn.incubateeId, "Connection request progressing", "The incubation team approved your request; it is now being routed.", "info", appId);
    await notifyRank(CONN_STAGES.manager_approved.requiredRank!, "Connection to route", `${who} forwarded a connection request for routing.`, appId, { ctaPath: "/network", ctaLabel: "Route the request" });
  } else if (to === "routed") {
    await notify(conn.mentorId, "New mentee request 🤝", "The CIMP-BIIF office has routed a startup's request to you. Accept or decline it from your Mentor hub.", "info", appId, { ctaPath: "/mentor", ctaLabel: "Accept or decline" });
    await notify(conn.incubateeId, "Request sent to the mentor", "Your connection request has been sent to the mentor.", "info", appId);
  } else if (to === "active") {
    await notify(conn.incubateeId, "Connected! 🎉", `${user.name} accepted your connection request.`, "success", appId, { ctaPath: "/messages", ctaLabel: "Message your mentor" });
  } else if (to === "declined") {
    await notify(conn.incubateeId, "Mentor declined", `${user.name} is not able to take this on right now.${note ? ` Note: ${note}` : ""}`, "warning", appId, { ctaPath: "/connect", ctaLabel: "Find another mentor" });
  } else if (to === "rejected") {
    await notify(conn.incubateeId, "Connection request not approved", `Reason: ${note}`, "error", appId, { ctaPath: "/connect", ctaLabel: "See your requests" });
  }
  await audit(req, user, `connection.${action}`, "connection", conn.id, `${label}${note ? ` (remark: ${note})` : ""}`, { status: { from, to } });
  return NextResponse.json({ success: true, status: to });
}
