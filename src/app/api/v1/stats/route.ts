// Partner API v1 (read-only): programme statistics.   scope stats:read
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authApiKey } from "@/lib/integrations";

export async function GET(req: NextRequest) {
  const auth = await authApiKey(req.headers.get("authorization"), "stats:read");
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const [applications, incubated, published, mentors, investors, sessions, bySector] = await Promise.all([
    prisma.application.count(),
    prisma.application.count({ where: { status: "approved" } }),
    prisma.application.count({ where: { status: "approved", isPublic: true } }),
    prisma.mentorProfile.count({ where: { status: "approved" } }),
    prisma.mentorProfile.count({ where: { investorStatus: "approved" } }),
    prisma.mentorSession.count({ where: { status: "completed" } }),
    prisma.application.groupBy({ by: ["industry"], where: { status: "approved" }, _count: { _all: true } }),
  ]);
  return NextResponse.json({
    success: true,
    data: { applications, incubated, published, mentors, investors, mentoringSessions: sessions, incubatedBySector: Object.fromEntries(bySector.map((s) => [s.industry, s._count._all])) },
    meta: { generatedAt: new Date().toISOString() },
  }, { headers: { "Cache-Control": "no-store" } });
}
