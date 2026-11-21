// Serve or delete one document. Private documents: the applicant and the office only.
// The logo of a published startup is public (it appears on the directory and profile page).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { isOfficeRole } from "@/lib/workflow";
import { DOC_KIND_MAP, type DocKind } from "@/lib/documents";
import { readStored, deleteStored } from "@/lib/storage";
import { audit } from "@/lib/audit";

async function load(id: string) {
  return prisma.applicationDocument.findUnique({
    where: { id },
    include: { application: { select: { id: true, userId: true, isPublic: true, status: true, isEditable: true } } },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await load(params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const publicLogo = doc.kind === "logo" && doc.application.isPublic && doc.application.status === "approved";
  if (!publicLogo) {
    const user = getSessionUser(req);
    const allowed = user && (isOfficeRole(user.role) || (user.role === "incubatee" && user.userId === doc.application.userId));
    if (!allowed) return NextResponse.json({ error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
  }

  let body: Buffer;
  try { body = await readStored(doc.storedName); } catch { return NextResponse.json({ error: "File missing" }, { status: 404 }); }

  const inline = doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/");
  const safeName = doc.fileName.replace(/["\\\r\n]/g, "_");
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      // Treat the file as untrusted content: no scripts, no same-origin access
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": publicLogo ? "public, max-age=300" : "private, no-store",
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await load(params.id);
  if (!doc || user.role !== "incubatee" || doc.application.userId !== user.userId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!doc.application.isEditable && doc.kind !== "logo")
    return NextResponse.json({ error: "Documents are locked while your application is under review" }, { status: 400 });

  await prisma.applicationDocument.delete({ where: { id: doc.id } });
  await deleteStored(doc.storedName);
  if (doc.kind === "pitch_deck")
    await prisma.application.update({ where: { id: doc.applicationId }, data: { pitchDeckUrl: null, pitchDeckName: null } });
  await prisma.activity.create({
    data: { applicationId: doc.applicationId, actorName: user.name, actorRole: user.role, action: `removed ${DOC_KIND_MAP[doc.kind as DocKind]?.label.toLowerCase() ?? "document"}`, detail: doc.fileName },
  });
  await audit(req, user, "document.delete", "document", doc.id, `Removed ${DOC_KIND_MAP[doc.kind as DocKind]?.label.toLowerCase() ?? "document"} "${doc.fileName}"`);
  return NextResponse.json({ success: true });
}
