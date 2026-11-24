// CRM (BIIF 2.0): partners and their activity log.
//   GET                                   partners with open follow-ups and recent activity
//   POST  { kind:"partner", ...fields }   add a partner
//   PUT   { partnerId, ...fields }        update a partner (stage, owner, MoU dates…)
//   POST  { kind:"activity", partnerId, activity, summary, dueAt? }   log an activity / follow-up
//   PATCH { activityId, done }            tick a follow-up
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId, str } from "@/lib/serialize";
import { ACTIVITY_KINDS, PARTNER_STAGES, PARTNER_TYPES, canUseCrm, stageLabel } from "@/lib/crm";
import { audit } from "@/lib/audit";

const date = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? undefined : d; };

function parsePartner(b: any) {
  const name = str(b.name, 140);
  if (name.length < 2) return { error: "Give the partner's name" };
  if (!PARTNER_TYPES.some((t) => t.value === b.type)) return { error: "Choose a partner type" };
  if (!PARTNER_STAGES.some((t) => t.value === b.stage)) return { error: "Choose a stage" };
  const contactEmail = str(b.contactEmail, 160);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { error: "Enter a valid contact email" };
  const website = str(b.website, 200);
  if (website && !/^https?:\/\/\S+\.\S+/.test(website)) return { error: "The website must start with http:// or https://" };
  const value = b.expectedValueInr === "" || b.expectedValueInr == null ? null : Math.round(Number(b.expectedValueInr));
  if (value !== null && (!Number.isFinite(value) || value < 0)) return { error: "Expected value must be a number" };
  const mouSignedOn = date(b.mouSignedOn), mouExpiresOn = date(b.mouExpiresOn);
  if (mouSignedOn === undefined || mouExpiresOn === undefined) return { error: "Enter valid MoU dates" };
  if (mouSignedOn && mouExpiresOn && mouExpiresOn <= mouSignedOn) return { error: "The MoU must expire after it is signed" };
  return { data: { name, type: b.type, stage: b.stage, contactName: str(b.contactName, 120) || null, contactEmail: contactEmail || null, contactPhone: str(b.contactPhone, 30) || null, website: website || null, expectedValueInr: value, notes: str(b.notes, 4000) || null, mouSignedOn, mouExpiresOn } };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseCrm(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const partners = await prisma.partner.findMany({ include: { activities: { orderBy: { createdAt: "desc" }, take: 30 } }, orderBy: { updatedAt: "desc" } });
  const soon = new Date(Date.now() + 30 * 864e5);
  return NextResponse.json({
    partners: withId(partners),
    followUpsDue: partners.flatMap((p) => p.activities.filter((a) => a.kind === "follow_up" && !a.done && a.dueAt && a.dueAt <= new Date(Date.now() + 864e5)).map((a) => ({ ...withId(a), partnerName: p.name }))),
    mouExpiring: partners.filter((p) => p.mouExpiresOn && p.mouExpiresOn <= soon && p.mouExpiresOn >= new Date()).map((p) => ({ _id: p.id, name: p.name, mouExpiresOn: p.mouExpiresOn })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseCrm(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.kind === "activity") {
    if (!isId(b.partnerId)) return NextResponse.json({ error: "partnerId required" }, { status: 400 });
    if (!ACTIVITY_KINDS.some((k) => k.value === b.activity)) return NextResponse.json({ error: "Choose the activity type" }, { status: 400 });
    const summary = str(b.summary, 2000);
    if (!summary) return NextResponse.json({ error: "Write what happened or what to do" }, { status: 400 });
    const dueAt = date(b.dueAt);
    if (dueAt === undefined) return NextResponse.json({ error: "Enter a valid due date" }, { status: 400 });
    if (b.activity === "follow_up" && !dueAt) return NextResponse.json({ error: "A follow-up needs a due date" }, { status: 400 });
    const p = await prisma.partner.findUnique({ where: { id: b.partnerId }, select: { id: true, name: true } });
    if (!p) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    const a = await prisma.partnerActivity.create({ data: { partnerId: p.id, kind: b.activity, summary, dueAt, byId: user.userId, byName: user.name } });
    await prisma.partner.update({ where: { id: p.id }, data: { updatedAt: new Date() } });
    await audit(req, user, "partner.activity", "partner", p.id, `Logged ${b.activity.replace("_", "-")} with ${p.name}: ${summary.slice(0, 120)}`);
    return NextResponse.json({ success: true, activity: withId(a) }, { status: 201 });
  }
  const parsed = parsePartner(b);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const p = await prisma.partner.create({ data: { ...parsed.data!, ownerId: user.userId, ownerName: user.name } });
  await audit(req, user, "partner.create", "partner", p.id, `Added partner ${p.name} (${p.type}, ${stageLabel(p.stage)})`);
  return NextResponse.json({ success: true, partner: withId(p) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseCrm(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!isId(b.partnerId)) return NextResponse.json({ error: "partnerId required" }, { status: 400 });
  const before = await prisma.partner.findUnique({ where: { id: b.partnerId } });
  if (!before) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  const parsed = parsePartner(b);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const p = await prisma.partner.update({ where: { id: before.id }, data: parsed.data! });
  await audit(req, user, "partner.update", "partner", p.id, `Updated partner ${p.name}${before.stage !== p.stage ? `: ${stageLabel(before.stage)} → ${stageLabel(p.stage)}` : ""}`,
    before.stage !== p.stage ? { stage: { from: before.stage, to: p.stage } } : null);
  return NextResponse.json({ success: true, partner: withId(p) });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseCrm(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { activityId, done } = await req.json().catch(() => ({}));
  if (!isId(activityId) || typeof done !== "boolean") return NextResponse.json({ error: "activityId and done required" }, { status: 400 });
  const a = await prisma.partnerActivity.update({ where: { id: activityId }, data: { done } }).catch(() => null);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit(req, user, "partner.follow_up", "partner", a.partnerId, `${done ? "Completed" : "Reopened"} follow-up: ${a.summary.slice(0, 120)}`);
  return NextResponse.json({ success: true });
}
