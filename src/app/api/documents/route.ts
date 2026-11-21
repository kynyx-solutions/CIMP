// Application documents (PRD DOC-1, DOC-2).
//   GET  /api/documents?applicationId=…          list (applicant or office)
//   POST /api/documents  multipart {applicationId, kind, file}   upload / replace (applicant)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { isOfficeRole } from "@/lib/workflow";
import { DOC_KIND_MAP, MIME, formatBytes, type DocKind } from "@/lib/documents";
import { sniffType, saveFile, deleteStored } from "@/lib/storage";
import { audit } from "@/lib/audit";

const PUBLIC_FIELDS = { id: true, kind: true, fileName: true, mimeType: true, size: true, createdAt: true } as const;

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const applicationId = req.nextUrl.searchParams.get("applicationId");
  if (!isId(applicationId)) return NextResponse.json({ error: "applicationId required" }, { status: 400 });

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { userId: true } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isOfficeRole(user.role) && !(user.role === "incubatee" && app.userId === user.userId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const documents = await prisma.applicationDocument.findMany({ where: { applicationId }, select: PUBLIC_FIELDS, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ documents: withId(documents) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "incubatee") return NextResponse.json({ error: "Only the applicant can upload documents" }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected a file upload" }, { status: 400 }); }
  const file = form.get("file");
  const applicationId = form.get("applicationId");
  const kind = form.get("kind") as DocKind;
  const def = DOC_KIND_MAP[kind];
  if (!(file instanceof File) || !isId(applicationId) || !def)
    return NextResponse.json({ error: "file, applicationId and a valid kind are required" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  if (file.size > def.maxBytes) return NextResponse.json({ error: `${def.label} must be under ${formatBytes(def.maxBytes)}` }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { id: applicationId, userId: user.userId } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Review documents freeze with the application; the logo is branding and can change any time.
  if (!app.isEditable && kind !== "logo")
    return NextResponse.json({ error: "Your application is under review, so documents are locked" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buf);
  if (!type || !def.types.includes(type))
    return NextResponse.json({ error: `${def.label} must be ${def.types.map((t) => t.toUpperCase()).join(", ")}` }, { status: 400 });

  const storedName = await saveFile(buf, type);
  const fileName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `${kind}.${type}`;
  const previous = await prisma.applicationDocument.findUnique({ where: { applicationId_kind: { applicationId: app.id, kind } } });

  const doc = await prisma.applicationDocument.upsert({
    where: { applicationId_kind: { applicationId: app.id, kind } },
    create: { applicationId: app.id, kind, fileName, storedName, mimeType: MIME[type], size: buf.length, uploadedBy: user.userId },
    update: { fileName, storedName, mimeType: MIME[type], size: buf.length, uploadedBy: user.userId, createdAt: new Date() },
    select: PUBLIC_FIELDS,
  });
  if (previous) await deleteStored(previous.storedName);

  // Keep the legacy deck fields in step: list badges and the approvals panel read them.
  if (kind === "pitch_deck")
    await prisma.application.update({ where: { id: app.id }, data: { pitchDeckUrl: `/api/documents/${doc.id}`, pitchDeckName: fileName } });

  await prisma.activity.create({
    data: { applicationId: app.id, actorName: user.name, actorRole: user.role, action: `${previous ? "replaced" : "uploaded"} ${def.label.toLowerCase()}`, detail: fileName },
  });
  await audit(req, user, previous ? "document.replace" : "document.upload", "document", doc.id,
    `${previous ? "Replaced" : "Uploaded"} ${def.label.toLowerCase()} "${fileName}" (${formatBytes(buf.length)}) for "${app.startupName}"`);
  return NextResponse.json({ success: true, document: withId(doc) }, { status: 201 });
}
