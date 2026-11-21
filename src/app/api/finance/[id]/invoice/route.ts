// Invoice / bill attached to a finance request.
//   POST multipart {file}   the requester, while the request is submitted or sent back
//   GET                     the requester, Accounts, Sr Manager and CEO
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { FINANCE_VIEWERS } from "@/lib/finance";
import { MIME, formatBytes } from "@/lib/documents";
import { sniffType, saveFile, readStored, deleteStored } from "@/lib/storage";
import { audit } from "@/lib/audit";

const MAX = 10 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user || !isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await prisma.financeRequest.findUnique({ where: { id: params.id } });
  if (!r || r.requestedById !== user.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["submitted", "returned"].includes(r.status)) return NextResponse.json({ error: "The invoice is locked once Accounts has verified the request" }, { status: 400 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected a file upload" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: `The file must be under ${formatBytes(MAX)}` }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffType(buf);
  if (!type || !["pdf", "jpg", "png"].includes(type)) return NextResponse.json({ error: "Upload a PDF, JPG or PNG" }, { status: 400 });
  const stored = await saveFile(buf, type);
  const name = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `invoice.${type}`;
  await prisma.financeRequest.update({ where: { id: r.id }, data: { invoiceName: name, invoiceStored: stored, invoiceMime: MIME[type], invoiceSize: buf.length } });
  if (r.invoiceStored) await deleteStored(r.invoiceStored);
  await audit(req, user, "finance.invoice", "finance", r.id, `Attached invoice "${name}" (${formatBytes(buf.length)}) to "${r.title}"`);
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user || !isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await prisma.financeRequest.findUnique({ where: { id: params.id } });
  if (!r?.invoiceStored || !r.invoiceMime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.requestedById !== user.userId && !FINANCE_VIEWERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: Buffer;
  try { body = await readStored(r.invoiceStored); } catch { return NextResponse.json({ error: "File missing" }, { status: 404 }); }
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": r.invoiceMime,
      "Content-Disposition": `inline; filename="${(r.invoiceName ?? "invoice").replace(/["\\\r\n]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
