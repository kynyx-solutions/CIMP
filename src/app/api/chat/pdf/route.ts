// Conversation history as PDF (PRD PDF-1). Same access as reading the thread.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { ROLE_LABELS } from "@/lib/workflow";
import { threadAccess, THREAD_TYPES, type ThreadType } from "@/lib/chat";
import { PdfBuilder, pdfResponse, MUTED } from "@/lib/pdf";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type") as ThreadType;
  const id = req.nextUrl.searchParams.get("id");
  if (!THREAD_TYPES.includes(type) || !isId(id)) return NextResponse.json({ error: "type and id are required" }, { status: 400 });
  const access = await threadAccess(user, type, id);
  if (!access.canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = type === "application"
    ? await prisma.message.findMany({ where: { applicationId: id }, orderBy: { createdAt: "asc" } })
    : await prisma.chatMessage.findMany({ where: { threadType: type, threadId: id }, orderBy: { createdAt: "asc" } });

  const kind = type === "application" ? "Applicant and office" : type === "connection" ? "Founder and mentor" : "Mentor and office";
  const pdf = await PdfBuilder.create(`Conversation: ${access.label}`, `${kind} · ${messages.length} message${messages.length === 1 ? "" : "s"}`);
  if (!messages.length) pdf.text("No messages.", { color: MUTED });
  for (const m of messages) {
    pdf.text(`${m.senderName} · ${ROLE_LABELS[m.senderRole] ?? m.senderRole} · ${m.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, { size: 8.5, bold: true, color: MUTED });
    pdf.text(m.content, { size: 10 });
    pdf.gap(8);
  }
  await audit(req, user, "message.export_pdf", "message", id, `Downloaded ${messages.length} messages of the ${type.replace("_", " ")} thread with ${access.label} as PDF`);
  return pdfResponse(await pdf.save(), `Conversation-${access.label}.pdf`);
}
