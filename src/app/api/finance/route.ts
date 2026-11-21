// Finance requests (BIIF 2.0 accounts module).
//   GET                    own requests; Accounts / Sr Manager / CEO: all, plus the seed-fund register
//   POST  { kind, title, description, amountInr, payee, applicationId? }      any office user
//   PUT   { requestId, ...same fields }        requester edits a returned request and resubmits
//   PATCH { requestId, action, remark, paymentRef }   review steps (see src/lib/finance.ts)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { ROLE_LABELS } from "@/lib/workflow";
import { CEO_LIMIT_INR, FINANCE_KINDS, FINANCE_VIEWERS, canActFinance, canRequestFinance, inr, kindLabel, nextStatus, type FinAction } from "@/lib/finance";
import { notify, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const INCLUDE = { steps: { orderBy: { at: "asc" as const } }, application: { select: { startupName: true } } };

async function usersWithRoles(roles: string[]) {
  return (await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } })).map((u) => u.id);
}

/** Seed fund still available for new tranches: sanctioned minus paid and in-flight tranches. */
async function trancheHeadroom(applicationId: string, excludeId?: string) {
  const fund = await prisma.seedFund.findUnique({ where: { applicationId } });
  if (!fund) return null;
  const used = await prisma.financeRequest.aggregate({
    where: { applicationId, kind: "grant_tranche", status: { notIn: ["rejected", "returned"] }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { amountInr: true },
  });
  return fund.sanctionedInr - (used._sum.amountInr ?? 0);
}

async function parse(body: any, excludeId?: string) {
  const kind = String(body.kind ?? "");
  if (!FINANCE_KINDS.some((k) => k.value === kind)) return { error: "Choose the type of request" };
  const title = str(body.title, 140), description = str(body.description, 3000), payee = str(body.payee, 140);
  const amountInr = Math.round(Number(body.amountInr));
  if (title.length < 4) return { error: "Give the request a title" };
  if (!description) return { error: "Describe what the payment is for" };
  if (!payee) return { error: "Name the payee" };
  if (!Number.isFinite(amountInr) || amountInr < 1 || amountInr > 50_000_000) return { error: "Enter an amount between ₹1 and ₹5 crore" };
  let applicationId: string | null = null;
  if (kind === "grant_tranche") {
    if (!isId(body.applicationId)) return { error: "Choose the startup for this tranche" };
    const head = await trancheHeadroom(body.applicationId, excludeId);
    if (head === null) return { error: "Record the startup's seed-fund sanction first" };
    if (amountInr > head) return { error: `Only ${inr(Math.max(0, head))} of the sanctioned seed fund is left for new tranches` };
    applicationId = body.applicationId;
  }
  return { data: { kind, title, description, payee, amountInr, applicationId } };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canRequestFinance(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const viewer = FINANCE_VIEWERS.includes(user.role);
  const [requests, funds, startups] = await Promise.all([
    prisma.financeRequest.findMany({ where: viewer ? {} : { requestedById: user.userId }, include: INCLUDE, orderBy: { updatedAt: "desc" }, take: 200 }),
    viewer ? prisma.seedFund.findMany({ include: { application: { select: { startupName: true } } }, orderBy: { sanctionedOn: "desc" } }) : Promise.resolve([]),
    prisma.application.findMany({ where: { status: "approved" }, select: { id: true, startupName: true }, orderBy: { startupName: "asc" } }),
  ]);
  // Per-startup disbursement summary for the seed-fund register
  const paid = viewer ? await prisma.financeRequest.groupBy({ by: ["applicationId", "status"], where: { kind: "grant_tranche", applicationId: { not: null } }, _sum: { amountInr: true } }) : [];
  const register = funds.map((f) => {
    const rows = paid.filter((p) => p.applicationId === f.applicationId);
    const sum = (st: string[]) => rows.filter((r) => st.includes(r.status)).reduce((n, r) => n + (r._sum.amountInr ?? 0), 0);
    return { ...withId(f), disbursed: sum(["paid"]), inFlight: sum(["submitted", "verified", "approved", "final_approved"]) };
  });
  return NextResponse.json({
    role: user.role, viewer, ceoLimit: CEO_LIMIT_INR,
    requests: withId(requests).map(({ invoiceStored, ...r }: any) => ({ ...r, hasInvoice: !!invoiceStored, mine: r.requestedById === user.userId })),
    register, startups: withId(startups),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canRequestFinance(user.role)) return NextResponse.json({ error: "Only office users raise finance requests" }, { status: 403 });
  const p = await parse(await req.json().catch(() => ({})));
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  const r = await prisma.financeRequest.create({
    data: { ...p.data!, requestedById: user.userId, requestedBy: user.name,
      steps: { create: { fromStatus: "new", toStatus: "submitted", action: "raised the request", actorId: user.userId, actorName: user.name, actorRole: user.role } } },
  });
  await audit(req, user, "finance.submit", "finance", r.id, `Raised ${kindLabel(r.kind).toLowerCase()} "${r.title}" for ${inr(r.amountInr)} to ${r.payee}`);
  await notifyUsers(await usersWithRoles(["accounts"]), "Finance request to verify", `${user.name}: "${r.title}" (${inr(r.amountInr)}).`, "info", r.applicationId ?? undefined, { ctaPath: "/finance", ctaLabel: "Open finance" });
  return NextResponse.json({ success: true, request: withId(r) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isId(body.requestId)) return NextResponse.json({ error: "requestId required" }, { status: 400 });
  const r = await prisma.financeRequest.findUnique({ where: { id: body.requestId } });
  if (!r || r.requestedById !== user.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.status !== "returned") return NextResponse.json({ error: "Only a request sent back to you can be edited" }, { status: 400 });
  const p = await parse(body, r.id);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  await prisma.financeRequest.update({
    where: { id: r.id },
    data: { ...p.data!, status: "submitted", steps: { create: { fromStatus: "returned", toStatus: "submitted", action: "resubmitted with changes", actorId: user.userId, actorName: user.name, actorRole: user.role } } },
  });
  await audit(req, user, "finance.resubmit", "finance", r.id, `Resubmitted "${p.data!.title}" for ${inr(p.data!.amountInr)}`, { amountInr: { from: r.amountInr, to: p.data!.amountInr } });
  await notifyUsers(await usersWithRoles(["accounts"]), "Finance request resubmitted", `"${p.data!.title}" (${inr(p.data!.amountInr)}) is back for verification.`, "info", undefined, { ctaPath: "/finance", ctaLabel: "Open finance" });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = body.action as FinAction;
  if (!isId(body.requestId) || !["verify", "approve", "final_approve", "pay", "send_back", "reject"].includes(action))
    return NextResponse.json({ error: "requestId and action required" }, { status: 400 });
  const r = await prisma.financeRequest.findUnique({ where: { id: body.requestId } });
  if (!r) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (r.requestedById === user.userId) return NextResponse.json({ error: "You cannot review your own request" }, { status: 403 });
  if (!canActFinance(user.role, r.status, action, r.amountInr)) return NextResponse.json({ error: "Your role cannot do this at the current step" }, { status: 403 });
  const remark = str(body.remark, 1000), paymentRef = str(body.paymentRef, 80);
  if ((action === "reject" || action === "send_back") && !remark) return NextResponse.json({ error: "Give a reason" }, { status: 400 });
  if (action === "pay" && paymentRef.length < 4) return NextResponse.json({ error: "Enter the payment reference (UTR / cheque number)" }, { status: 400 });

  const to = nextStatus(r.status, action, r.amountInr)!;
  const label = { verify: "verified the request", approve: "approved", final_approve: "gave CEO approval", pay: `recorded payment ${paymentRef}`, send_back: "sent back for changes", reject: "rejected" }[action];
  await prisma.financeRequest.update({
    where: { id: r.id },
    data: { status: to, ...(action === "pay" ? { paymentRef, paidAt: new Date() } : {}),
      steps: { create: { fromStatus: r.status, toStatus: to, action: label, actorId: user.userId, actorName: user.name, actorRole: user.role, remark: remark || null } } },
  });
  const by = `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`;
  await audit(req, user, `finance.${action}`, "finance", r.id, `${by} ${label}: "${r.title}" (${inr(r.amountInr)})${remark ? ` — ${remark}` : ""}`, { status: { from: r.status, to } });

  // Tell the next person in line, and the requester at the end
  const ctx = { ctaPath: "/finance", ctaLabel: "Open finance" };
  if (to === "verified") await notifyUsers(await usersWithRoles(["sr_manager"]), "Finance request to approve", `"${r.title}" (${inr(r.amountInr)}) was verified by Accounts.`, "info", undefined, ctx);
  if (to === "approved") {
    if (r.amountInr > CEO_LIMIT_INR) await notifyUsers(await usersWithRoles(["ceo"]), "Finance request needs CEO approval", `"${r.title}" (${inr(r.amountInr)}) is above ${inr(CEO_LIMIT_INR)}.`, "info", undefined, ctx);
    else await notifyUsers(await usersWithRoles(["accounts"]), "Approved: ready to pay", `"${r.title}" (${inr(r.amountInr)}) is approved.`, "info", undefined, ctx);
  }
  if (to === "final_approved") await notifyUsers(await usersWithRoles(["accounts"]), "CEO approved: ready to pay", `"${r.title}" (${inr(r.amountInr)}).`, "info", undefined, ctx);
  if (["paid", "returned", "rejected"].includes(to))
    await notify(r.requestedById, to === "paid" ? "Payment made" : to === "returned" ? "Finance request sent back" : "Finance request rejected",
      to === "paid" ? `"${r.title}" was paid (${inr(r.amountInr)}, ref ${paymentRef}).` : `"${r.title}": ${remark}`,
      to === "paid" ? "success" : to === "returned" ? "warning" : "error", r.applicationId ?? undefined, ctx);
  if (to === "paid" && r.kind === "grant_tranche" && r.applicationId) {
    const app = await prisma.application.findUnique({ where: { id: r.applicationId }, select: { userId: true, startupName: true } });
    if (app) await notify(app.userId, "Seed-fund tranche released", `${inr(r.amountInr)} has been released to "${app.startupName}" (ref ${paymentRef}).`, "success", r.applicationId, { ctaPath: "/dashboard", ctaLabel: "Open dashboard" });
  }
  return NextResponse.json({ success: true, status: to });
}
