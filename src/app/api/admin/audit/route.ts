// Read the audit log (PRD AUD-1). Only the CEO and Admin IT. Read-only: there is no write,
// update or delete endpoint, and the table itself rejects UPDATE/DELETE.
//   GET ?entity=&action=&actor=&q=&from=&to=&cursor=   → 50 newest matching rows
//   GET ...&format=csv                                  → up to 5,000 rows as CSV
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isId } from "@/lib/serialize";

const PAGE = 50;
const ENTITIES = ["application", "document", "mentor_profile", "connection", "user", "form", "site_config", "message", "auth",
  "qpr", "session", "doc_request", "proposal", "blog", "id_card", "export", "notification", "job"];

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || !["ceo", "admin_it"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = req.nextUrl.searchParams;
  const where: Prisma.AuditLogWhereInput = {};
  const entity = p.get("entity");
  if (entity && ENTITIES.includes(entity)) where.entity = entity;
  const action = p.get("action")?.trim();
  if (action) where.action = { startsWith: action.slice(0, 60) };
  const actor = p.get("actor")?.trim();
  if (actor) where.actorName = { contains: actor.slice(0, 80), mode: "insensitive" };
  const entityId = p.get("entityId");
  if (entityId && /^[\w-]{1,40}$/.test(entityId)) where.entityId = entityId;
  const q = p.get("q")?.trim();
  if (q) where.summary = { contains: q.slice(0, 100), mode: "insensitive" };
  const from = p.get("from"), to = p.get("to");
  if (from || to) {
    where.at = {};
    if (from && !Number.isNaN(Date.parse(from))) where.at.gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) where.at.lte = new Date(new Date(to).getTime() + 86_400_000 - 1); // whole "to" day
  }

  if (p.get("format") === "csv") {
    const rows = await prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 5000 });
    const cell = (v: unknown) => {
      let s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection when opened in Excel
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = ["Time (UTC),Actor,Role,Action,Entity,Entity ID,Summary,Changes,IP"]
      .concat(rows.map((r) => [r.at.toISOString(), r.actorName, r.actorRole, r.action, r.entity, r.entityId, r.summary, r.diff, r.ip].map(cell).join(",")))
      .join("\r\n");
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const cursor = p.get("cursor");
  const rows = await prisma.auditLog.findMany({
    where, orderBy: [{ at: "desc" }, { id: "desc" }], take: PAGE + 1,
    ...(cursor && isId(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  return NextResponse.json({
    entries: page.map((r) => ({ ...r, _id: r.id })),
    nextCursor: more ? page[page.length - 1].id : null,
    total: await prisma.auditLog.count({ where }),
  });
}
