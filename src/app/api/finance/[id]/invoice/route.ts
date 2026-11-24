// Invoice / bill attached to a finance request.
//   POST file (multipart or upload ticket)   the requester, while the request is submitted or sent back
//   GET                     the requester, Accounts, Sr Manager and CEO
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { FINANCE_VIEWERS } from "@/lib/finance";
import { formatBytes } from "@/lib/documents";
import { sendStored } from "@/lib/storage";
import { receiveUpload, replaceStored } from "@/lib/uploads";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user || !isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await prisma.financeRequest.findUnique({ where: { id: params.id } });
  if (!r || r.requestedById !== user.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["submitted", "returned"].includes(r.status)) return NextResponse.json({ error: "The invoice is locked once Accounts has verified the request" }, { status: 400 });
  const upload = await receiveUpload(req, user.userId);
  if ("error" in upload) return NextResponse.json({ error: upload.error }, { status: 400 });
  const file = await upload.commit("invoice");
  if ("error" in file) return NextResponse.json({ error: file.error }, { status: 400 });
  const { storedName, fileName: name, mimeType, size } = file;
  await prisma.financeRequest.update({ where: { id: r.id }, data: { invoiceName: name, invoiceStored: storedName, invoiceMime: mimeType, invoiceSize: size } });
  await replaceStored(r.invoiceStored, storedName);
  await audit(req, user, "finance.invoice", "finance", r.id, `Attached invoice "${name}" (${formatBytes(size)}) to "${r.title}"`);
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user || !isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await prisma.financeRequest.findUnique({ where: { id: params.id } });
  if (!r?.invoiceStored || !r.invoiceMime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.requestedById !== user.userId && !FINANCE_VIEWERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return sendStored(r.invoiceStored, { fileName: r.invoiceName ?? "invoice", contentType: r.invoiceMime, inline: true });
}
