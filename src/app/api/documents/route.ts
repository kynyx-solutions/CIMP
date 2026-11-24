// Application documents (PRD DOC-1, DOC-2).
//   GET  /api/documents?applicationId=…          list (applicant or office)
//   POST /api/documents  {applicationId, kind} + file (multipart or upload ticket)   upload / replace (applicant)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { canViewApplicants } from "@/lib/workflow";
import { DOC_KIND_MAP, formatBytes, type DocKind } from "@/lib/documents";
import { receiveUpload, replaceStored } from "@/lib/uploads";
import { audit } from "@/lib/audit";

const PUBLIC_FIELDS = { id: true, kind: true, fileName: true, mimeType: true, size: true, createdAt: true } as const;

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const applicationId = req.nextUrl.searchParams.get("applicationId");
  if (!isId(applicationId)) return NextResponse.json({ error: "applicationId required" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { userId: true } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewApplicants(user.role) && !(user.role === "incubatee" && app.userId === user.userId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documents = await prisma.applicationDocument.findMany({ where: { applicationId }, select: PUBLIC_FIELDS, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ documents: withId(documents) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "incubatee") return NextResponse.json({ error: "Only the applicant can upload documents" }, { status: 403 });

  const upload = await receiveUpload(req, user.userId);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const { applicationId, kind } = upload.fields;
  const def = DOC_KIND_MAP[kind as DocKind];
  if (!isId(applicationId) || !def)
    return NextResponse.json({ error: "file, applicationId and a valid kind are required" }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Review documents freeze with the application; the logo is branding and can change any time.
  if (!app.isEditable && def.kind !== "logo")
    return NextResponse.json({ error: "Your application is under review, so documents are locked" }, { status: 400 });

  const file = await upload.commit(def.kind);
  if ("error" in file) return NextResponse.json({ error: file.error }, { status: 400 });
  const { storedName, fileName, mimeType, size } = file;
  const where = { applicationId_kind: { applicationId: app.id, kind: def.kind } };
  const previous = await prisma.applicationDocument.findUnique({ where });

  const doc = await prisma.applicationDocument.upsert({
    where,
    create: { applicationId: app.id, kind: def.kind, fileName, storedName, mimeType, size, uploadedBy: user.userId },
    update: { fileName, storedName, mimeType, size, uploadedBy: user.userId, createdAt: new Date() },
    select: PUBLIC_FIELDS,
  });
  await replaceStored(previous?.storedName, storedName);

  // Keep the legacy deck fields in step: list badges and the approvals panel read them.
  if (def.kind === "pitch_deck")
    await prisma.application.update({ where: { id: app.id }, data: { pitchDeckUrl: `/api/documents/${doc.id}`, pitchDeckName: fileName } });

  await prisma.activity.create({
    data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: `${previous ? "replaced" : "uploaded"} ${def.label.toLowerCase()}`, detail: fileName },
  });
  await audit(req, user, previous ? "document.replace" : "document.upload", "document", doc.id,
    `${previous ? "Replaced" : "Uploaded"} ${def.label.toLowerCase()} "${fileName}" (${formatBytes(size)}) for "${app.startupName}"`);
  return NextResponse.json({ success: true, document: withId(doc) }, { status: 201 });
}
