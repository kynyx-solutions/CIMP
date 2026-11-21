// Download a finished export: only the person who requested it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";
import { DATASETS, REPORT_ROLES, type DatasetKey } from "@/lib/exports";
import { readStored } from "@/lib/storage";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user || !REPORT_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const job = await prisma.exportJob.findUnique({ where: { id: params.id } });
  if (!job || job.requestedById !== user.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "done" || !job.storedName) return NextResponse.json({ error: "Not ready yet" }, { status: 409 });
  let body: Buffer;
  try { body = await readStored(job.storedName); } catch { return NextResponse.json({ error: "File missing" }, { status: 404 }); }
  const label = DATASETS[job.dataset as DatasetKey]?.label ?? job.dataset;
  await audit(req, user, "export.download", "export", job.id, `Downloaded the Excel export of ${label} (${job.rowCount ?? 0} rows)`);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="CIMP-BIIF-${job.dataset}-${job.createdAt.toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
