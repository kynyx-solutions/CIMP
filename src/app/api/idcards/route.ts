// Virtual ID cards (PRD IDC-1).
//   GET                         Admin IT / CEO: every eligible holder with card status · others: own card
//   POST  { userId }            Admin IT issues or renews a card and emails it
//   PATCH { userId, action: revoke, reason }   Admin IT
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { eligibleHolders, isEligible, issueCard, emailCard } from "@/lib/idcard";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";

const MANAGERS = ["admin_it", "ceo"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MANAGERS.includes(user.role)) {
    const card = await prisma.idCard.findUnique({ where: { userId: user.userId } });
    return NextResponse.json({ card: card ? withId(card) : null, eligible: !!(await isEligible(user.userId)) });
  }
  const [holders, cards] = await Promise.all([eligibleHolders(), prisma.idCard.findMany()]);
  const byUser = new Map(cards.map((c) => [c.userId, c]));
  const rows = holders.map((h) => ({ ...h, card: byUser.get(h.userId) ? withId(byUser.get(h.userId)) : null }));
  // Cards whose holders are no longer eligible (e.g. mentor profile withdrawn) stay visible to the office
  const orphans = cards.filter((c) => !holders.some((h) => h.userId === c.userId)).map((c) => ({ userId: c.userId, name: c.holderName, email: "", role: "", roleLabel: c.role, organisation: c.organisation, card: withId(c), ineligible: true }));
  return NextResponse.json({ rows: [...rows, ...orphans], canIssue: user.role === "admin_it" });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin_it") return NextResponse.json({ error: "Only Admin IT issues ID cards" }, { status: 403 });
  const { userId } = await req.json().catch(() => ({}));
  if (!isId(userId)) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const holder = await isEligible(userId);
  if (!holder) return NextResponse.json({ error: "Only approved incubatees and mentors can hold a card" }, { status: 400 });
  const { card, renewed } = await issueCard(holder);
  await emailCard(card, renewed);
  await audit(req, user, renewed ? "id_card.renew" : "id_card.issue", "id_card", card.id, `${renewed ? "Renewed" : "Issued"} ID card ${card.number} for ${holder.name} (${holder.roleLabel}), valid till ${card.expiresAt.toLocaleDateString("en-IN")}`);
  return NextResponse.json({ success: true, card: withId(card), renewed });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin_it") return NextResponse.json({ error: "Only Admin IT manages ID cards" }, { status: 403 });
  const { userId, action, reason } = await req.json().catch(() => ({}));
  if (!isId(userId) || action !== "revoke") return NextResponse.json({ error: "userId and action required" }, { status: 400 });
  const r = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
  if (!r) return NextResponse.json({ error: "Give a reason" }, { status: 400 });
  const card = await prisma.idCard.findUnique({ where: { userId } });
  if (!card || card.status === "revoked") return NextResponse.json({ error: "No active card" }, { status: 400 });
  await prisma.idCard.update({ where: { id: card.id }, data: { status: "revoked" } });
  await audit(req, user, "id_card.revoke", "id_card", card.id, `Revoked ID card ${card.number} of ${card.holderName} (reason: ${r})`, { status: { from: card.status, to: "revoked" } });
  await notify(userId, "ID card revoked", `Your CIMP-BIIF ID card ${card.number} was revoked. Reason: ${r}`, "warning");
  return NextResponse.json({ success: true });
}
