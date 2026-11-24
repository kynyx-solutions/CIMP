// A document the mentor asked for (PRD MEN-4).
//   POST file (multipart or upload ticket)   the startup uploads (or replaces) it
//   GET                     the mentor, the startup and the office download it
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { mentorshipAccess } from "@/lib/mentorship";
import { formatBytes } from "@/lib/documents";
import { sendStored } from "@/lib/storage";
import { receiveUpload, replaceStored } from "@/lib/uploads";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = await prisma.docRequest.findUnique({ where: { id: params.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await mentorshipAccess(user, d.connectionId);
  if (!access?.isMentee || !access.canAct) return NextResponse.json({ error: "Only the startup can upload this document" }, { status: 403 });
  if (d.status === "closed") return NextResponse.json({ error: "The mentor closed this request" }, { status: 400 });

  const upload = await receiveUpload(req, user.userId);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const file = await upload.commit("doc_request");
  if ("error" in file) return NextResponse.json({ error: file.error }, { status: 400 });
  const { storedName, fileName, mimeType, size } = file;
  await prisma.docRequest.update({ where: { id: d.id }, data: { status: "uploaded", fileName, storedName, mimeType, size, uploadedAt: new Date() } });
  await replaceStored(d.storedName, storedName);
  await audit(req, user, "doc_request.upload", "doc_request", d.id, `Uploaded "${fileName}" (${formatBytes(size)}) for "${d.title}"`);
  await notify(access.other!, "Document uploaded", `${user.name} uploaded ${d.title}.`, "success", access.conn.applicationId ?? undefined,
    { ctaPath: `/mentorship/${d.connectionId}`, ctaLabel: "Open it" });
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = await prisma.docRequest.findUnique({ where: { id: params.id } });
  if (!d?.storedName || !d.mimeType) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await mentorshipAccess(user, d.connectionId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const inline = d.mimeType === "application/pdf" || d.mimeType.startsWith("image/");
  return sendStored(d.storedName, { fileName: d.fileName ?? "document", contentType: d.mimeType, inline });
}
