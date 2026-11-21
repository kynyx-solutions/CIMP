// A document the mentor asked for (PRD MEN-4).
//   POST multipart {file}   the startup uploads (or replaces) it
//   GET                     the mentor, the startup and the office download it
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { mentorshipAccess, DOC_REQUEST_MAX, DOC_REQUEST_TYPES } from "@/lib/mentorship";
import { MIME, formatBytes } from "@/lib/documents";
import { sniffType, saveFile, readStored, deleteStored } from "@/lib/storage";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = await prisma.docRequest.findUnique({ where: { id: params.id } });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await mentorshipAccess(user, d.connectionId);
  if (!access?.isMentee || !access.canAct) return NextResponse.json({ error: "Only the startup can upload this document" }, { status: 403 });
  if (d.status === "closed") return NextResponse.json({ error: "The mentor closed this request" }, { status: 400 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected a file upload" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  if (file.size > DOC_REQUEST_MAX) return NextResponse.json({ error: `The file must be under ${formatBytes(DOC_REQUEST_MAX)}` }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buf);
  if (!type || !(DOC_REQUEST_TYPES as readonly string[]).includes(type)) return NextResponse.json({ error: "Upload a PDF, JPG, PNG or PowerPoint file" }, { status: 400 });

  const storedName = await saveFile(buf, type);
  const fileName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `document.${type}`;
  await prisma.docRequest.update({ where: { id: d.id }, data: { status: "uploaded", fileName, storedName, mimeType: MIME[type], size: buf.length, uploadedAt: new Date() } });
  if (d.storedName) await deleteStored(d.storedName);
  await audit(req, user, "doc_request.upload", "doc_request", d.id, `Uploaded "${fileName}" (${formatBytes(buf.length)}) for "${d.title}"`);
  await notify(access.other!, "Document uploaded", `${user.name} uploaded ${d.title}.`, "success", access.conn.applicationId ?? undefined,
    { ctaPath: `/mentorship/${d.connectionId}`, ctaLabel: "Open it" });
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = await prisma.docRequest.findUnique({ where: { id: params.id } });
  if (!d?.storedName || !d.mimeType) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await mentorshipAccess(user, d.connectionId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: Buffer;
  try { body = await readStored(d.storedName); } catch { return NextResponse.json({ error: "File missing" }, { status: 404 }); }
  const inline = d.mimeType === "application/pdf" || d.mimeType.startsWith("image/");
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": d.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${(d.fileName ?? "document").replace(/["\\\r\n]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
