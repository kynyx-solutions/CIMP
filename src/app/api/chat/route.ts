// One endpoint for every conversation type (PRD MSG-1, MSG-2).
//   GET  /api/chat?type=connection&id=…   → messages (+ marks the other side's messages read)
//   POST /api/chat { type, id, content }  → send
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { threadAccess, notifyNewMessage, THREAD_TYPES, type ThreadType } from "@/lib/chat";
import { audit } from "@/lib/audit";

const MAX_LEN = 2000;

function parseThread(type: unknown, id: unknown): { type: ThreadType; id: string } | null {
  if (typeof type !== "string" || !THREAD_TYPES.includes(type as ThreadType) || !isId(id)) return null;
  return { type: type as ThreadType, id: id as string };
}

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t = parseThread(req.nextUrl.searchParams.get("type"), req.nextUrl.searchParams.get("id"));
  if (!t) return NextResponse.json({ error: "type and id are required" }, { status: 400 });

  const access = await threadAccess(user, t.type, t.id);
  if (!access.canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let messages;
  if (t.type === "application") {
    messages = await prisma.message.findMany({ where: { applicationId: t.id }, orderBy: { createdAt: "asc" } });
    if (access.canPost)
      await prisma.message.updateMany({ where: { applicationId: t.id, senderId: { not: user.userId }, read: false }, data: { read: true } });
  } else {
    const where = { threadType: t.type, threadId: t.id };
    messages = await prisma.chatMessage.findMany({ where, orderBy: { createdAt: "asc" } });
    // Office oversight reads must not mark a mentor conversation as read for its participants
    if (access.canPost || access.recipients.length)
      await prisma.chatMessage.updateMany({ where: { ...where, senderId: { not: user.userId }, read: false }, data: { read: true } });
  }
  return NextResponse.json({
    messages: withId(messages).map((m: any) => ({ ...m, mine: m.senderId === user.userId })),
    canPost: access.canPost, notice: access.notice ?? null, label: access.label,
  });
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const t = parseThread(body.type, body.id);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!t || !content) return NextResponse.json({ error: "type, id and a message are required" }, { status: 400 });
  if (content.length > MAX_LEN) return NextResponse.json({ error: `Keep messages under ${MAX_LEN} characters` }, { status: 400 });

  const access = await threadAccess(user, t.type, t.id);
  if (!access.canPost) return NextResponse.json({ error: access.canRead ? access.notice ?? "You cannot post here" : "Forbidden" }, { status: 403 });

  const base = { senderId: user.userId, senderName: user.name, senderRole: user.role, content };
  const message = t.type === "application"
    ? await prisma.message.create({ data: { ...base, applicationId: t.id } })
    : await prisma.chatMessage.create({ data: { ...base, threadType: t.type, threadId: t.id } });

  await notifyNewMessage(user, access, t.type);
  // Content stays in the conversation; the audit trail records who wrote where, not what.
  await audit(req, user, "message.send", "message", message.id, `Sent a message in ${t.type.replace("_", " ")} thread ${t.id}`);
  return NextResponse.json({ success: true, message: { ...withId(message), mine: true } }, { status: 201 });
}
