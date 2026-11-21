// Append-only audit trail (PRD AUD-1). Server-only.
// Every mutating API route calls audit() after the change succeeds. The table rejects
// UPDATE/DELETE at the database level (see migration admin_audit_forms_site).
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditEntity =
  | "application" | "document" | "mentor_profile" | "connection" | "user" | "form" | "site_config" | "message" | "auth";

export type Diff = Record<string, { from: unknown; to: unknown }>;

type Actor = { userId?: string | null; name: string; role: string } | null;

export function clientIp(req?: NextRequest | null): string | null {
  if (!req) return null;
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip"))?.trim().slice(0, 64) || null;
}

/**
 * Record one action. Never throws: a failed audit write is logged loudly but must not
 * undo a change the user already made (Phase 1 writes both in one transaction).
 */
export async function audit(
  req: NextRequest | null,
  actor: Actor,
  action: string,
  entity: AuditEntity,
  entityId: string | null,
  summary: string,
  diff?: Diff | null,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.userId ?? null,
        actorName: actor?.name ?? "System",
        actorRole: actor?.role ?? "system",
        action, entity, entityId, summary: summary.slice(0, 2000),
        diff: diff && Object.keys(diff).length ? (diff as Prisma.InputJsonValue) : undefined,
        ip: clientIp(req),
      },
    });
  } catch (err) {
    console.error("[audit] FAILED to write audit record", { action, entity, entityId }, err);
  }
}

/** Field-level diff of two plain objects, limited to `keys`. */
export function diffOf(before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]): Diff {
  const out: Diff = {};
  for (const k of keys) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b };
  }
  return out;
}
