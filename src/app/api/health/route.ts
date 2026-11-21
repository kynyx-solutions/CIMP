import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

// Liveness and readiness for Docker, the load balancer and uptime monitors.
// Public, so it reports only up/down and timings, never configuration.
export async function GET() {
  const started = Date.now();
  let db = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }
  const ok = db === "up";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", db, dbMs: Date.now() - started, uptimeS: Math.round(process.uptime()), version: pkg.version },
    { status: ok ? 200 : 503 },
  );
}
