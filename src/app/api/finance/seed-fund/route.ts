// Seed-fund register: record or change a startup's sanction (Accounts, Sr Manager, CEO).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { FINANCE_VIEWERS, inr } from "@/lib/finance";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !FINANCE_VIEWERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!isId(b.applicationId)) return NextResponse.json({ error: "Choose a startup" }, { status: 400 });
  const scheme = typeof b.scheme === "string" ? b.scheme.trim().slice(0, 120) : "";
  const amount = Math.round(Number(b.sanctionedInr));
  const on = new Date(String(b.sanctionedOn ?? ""));
  if (!scheme) return NextResponse.json({ error: "Name the scheme (e.g. Bihar Startup Policy seed fund)" }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 1000 || amount > 50_000_000) return NextResponse.json({ error: "Enter the sanctioned amount (₹1,000 to ₹5 crore)" }, { status: 400 });
  if (Number.isNaN(on.getTime()) || on.getTime() > Date.now() + 864e5) return NextResponse.json({ error: "Enter the sanction date" }, { status: 400 });
  const app = await prisma.application.findFirst({ where: { id: b.applicationId, status: "approved" }, select: { id: true, userId: true, startupName: true } });
  if (!app) return NextResponse.json({ error: "Only incubated startups can receive seed funds" }, { status: 400 });

  const before = await prisma.seedFund.findUnique({ where: { applicationId: app.id } });
  if (before) {
    const committed = await prisma.financeRequest.aggregate({ where: { applicationId: app.id, kind: "grant_tranche", status: { notIn: ["rejected", "returned"] } }, _sum: { amountInr: true } });
    if (amount < (committed._sum.amountInr ?? 0)) return NextResponse.json({ error: `Tranches of ${inr(committed._sum.amountInr ?? 0)} are already committed; the sanction cannot be lower` }, { status: 400 });
  }
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 1000) || null : null;
  const fund = await prisma.seedFund.upsert({
    where: { applicationId: app.id },
    create: { applicationId: app.id, scheme, sanctionedInr: amount, sanctionedOn: on, note, createdBy: user.name },
    update: { scheme, sanctionedInr: amount, sanctionedOn: on, note },
  });
  await audit(req, user, before ? "finance.seed_fund_update" : "finance.seed_fund_create", "finance", fund.id,
    `${before ? "Updated" : "Recorded"} seed-fund sanction of ${inr(amount)} (${scheme}) for "${app.startupName}"`, before ? { sanctionedInr: { from: before.sanctionedInr, to: amount } } : null);
  if (!before) await notify(app.userId, "Seed fund sanctioned 🎉", `${inr(amount)} has been sanctioned to "${app.startupName}" under ${scheme}. Tranches are released as milestones are met.`, "success", app.id, { ctaPath: "/dashboard", ctaLabel: "Open dashboard" });
  return NextResponse.json({ success: true, fund: withId(fund) });
}
