// Partner API v1 (read-only): published, approved startups with their public fields only.
//   GET /api/v1/startups?sector=&page=     Authorization: Bearer cbk_…   scope startups:read
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authApiKey } from "@/lib/integrations";
import { getForm } from "@/lib/forms-server";
import { publicFields, valueOf } from "@/lib/forms";

const PAGE = 50;

export async function GET(req: NextRequest) {
  const auth = await authApiKey(req.headers.get("authorization"), "startups:read");
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const sector = req.nextUrl.searchParams.get("sector")?.slice(0, 60) || undefined;
  const page = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get("page")) || 1));
  const where = { isPublic: true, status: "approved", ...(sector ? { industry: sector } : {}) };
  const [rows, total, form] = await Promise.all([
    prisma.application.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.application.count({ where }),
    getForm("application"),
  ]);
  const fields = publicFields(form);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const data = rows.map((r) => ({
    id: r.id,
    profileUrl: `${base}/startups/${r.id}`,
    incubatedSince: r.createdAt.toISOString().slice(0, 10),
    ...Object.fromEntries(fields.map((f) => [f.key, valueOf(r, f) ?? null])),
  }));
  return NextResponse.json({ success: true, data, meta: { page, pageSize: PAGE, total } }, { headers: { "Cache-Control": "no-store" } });
}
