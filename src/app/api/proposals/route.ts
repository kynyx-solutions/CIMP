// Investment proposals (PRD INV-1).
//   GET    investor: incubated startups, own proposals, portfolio · office: every proposal · founder: proposals about them
//   POST   { applicationId, amount, instrument, terms }      approved investors
//   PATCH  { proposalId, action: withdraw }                  the investor
//          { proposalId, action: schedule_pitch, pitchAt, note } | { action: invested|decline, note }   the office
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { isOfficeRole, ROLE_LABELS } from "@/lib/workflow";
import { INSTRUMENTS, OPEN_PROPOSAL, PROPOSAL_STATUS, canHandleProposals } from "@/lib/invest";
import { notify, notifyRank } from "@/lib/notify";
import { audit } from "@/lib/audit";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST";

async function isInvestor(userId: string) {
  const p = await prisma.mentorProfile.findUnique({ where: { userId }, select: { investorStatus: true } });
  return p?.investorStatus === "approved";
}

const PROPOSAL_INCLUDE = {
  investor: { select: { id: true, name: true, mentorProfile: { select: { headline: true, ticketSize: true } } } },
  application: { select: { id: true, startupName: true, industry: true, applicantName: true, userId: true } },
} as const;

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isOfficeRole(user.role)) {
    const proposals = await prisma.investmentProposal.findMany({ include: PROPOSAL_INCLUDE, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ role: "office", canHandle: canHandleProposals(user.role), proposals: withId(proposals) });
  }
  if (user.role === "incubatee") {
    // Founders hear about a proposal once the office has arranged a pitch
    const proposals = await prisma.investmentProposal.findMany({
      where: { application: { userId: user.userId }, status: { in: ["pitch_scheduled", "invested"] } },
      include: { investor: { select: { name: true, mentorProfile: { select: { headline: true } } } }, application: { select: { startupName: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ role: "founder", proposals: withId(proposals.map(({ terms, officeNote, ...p }) => p)) });
  }
  if (user.role === "mentor" && (await isInvestor(user.userId))) {
    const [startups, proposals] = await Promise.all([
      prisma.application.findMany({
        where: { status: "approved" },
        select: { id: true, startupName: true, industry: true, ventureStage: true, idea: true, city: true, state: true, isPublic: true },
        orderBy: { startupName: "asc" },
      }),
      prisma.investmentProposal.findMany({ where: { investorId: user.userId }, include: PROPOSAL_INCLUDE, orderBy: { updatedAt: "desc" } }),
    ]);
    // Portfolio: invested startups with their latest accepted progress report and the conversation
    const investedIds = proposals.filter((p) => p.status === "invested").map((p) => p.applicationId);
    const [reports, conns] = await Promise.all([
      prisma.qprReport.findMany({ where: { applicationId: { in: investedIds }, status: "accepted" }, orderBy: { period: "desc" } }),
      prisma.connection.findMany({ where: { mentorId: user.userId, applicationId: { in: investedIds }, status: "active" }, select: { id: true, applicationId: true } }),
    ]);
    const portfolio = proposals.filter((p) => p.status === "invested").map((p) => ({
      proposalId: p.id, applicationId: p.applicationId, startupName: p.application.startupName, industry: p.application.industry,
      amount: p.amount, instrument: p.instrument,
      latestReport: reports.find((r) => r.applicationId === p.applicationId) ?? null,
      connectionId: conns.find((c) => c.applicationId === p.applicationId)?.id ?? null,
    }));
    return NextResponse.json({ role: "investor", startups: withId(startups), proposals: withId(proposals), portfolio: withId(portfolio) });
  }
  return NextResponse.json({ error: "Investment proposals are for approved investors and the office" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user || user.role !== "mentor" || !(await isInvestor(user.userId))) return NextResponse.json({ error: "Only approved investors can send proposals" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!isId(body.applicationId)) return NextResponse.json({ error: "Choose a startup" }, { status: 400 });
  const amount = str(body.amount, 80), terms = str(body.terms, 2000);
  if (!amount) return NextResponse.json({ error: "Give the proposed amount" }, { status: 400 });
  if (!INSTRUMENTS.some((i) => i.value === body.instrument)) return NextResponse.json({ error: "Choose an instrument" }, { status: 400 });
  if (!terms) return NextResponse.json({ error: "Describe the proposal and its key terms" }, { status: 400 });

  const app = await prisma.application.findFirst({ where: { id: body.applicationId, status: "approved" }, select: { id: true, startupName: true } });
  if (!app) return NextResponse.json({ error: "Startup not found" }, { status: 404 });
  const open = await prisma.investmentProposal.findFirst({ where: { investorId: user.userId, applicationId: app.id, status: { in: OPEN_PROPOSAL } } });
  if (open) return NextResponse.json({ error: "You already have an open proposal for this startup" }, { status: 409 });

  const p = await prisma.investmentProposal.create({ data: { investorId: user.userId, applicationId: app.id, amount, instrument: body.instrument, terms } });
  await audit(req, user, "proposal.submit", "proposal", p.id, `Proposed ${amount} (${body.instrument}) in "${app.startupName}"`);
  await notifyRank(2, "New investment proposal", `${user.name} proposed ${amount} in "${app.startupName}". Arrange a pitch or respond.`, app.id, { ctaPath: "/invest", ctaLabel: "Open proposals" });
  return NextResponse.json({ success: true, proposal: withId(p) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isId(body.proposalId)) return NextResponse.json({ error: "proposalId required" }, { status: 400 });
  const p = await prisma.investmentProposal.findUnique({ where: { id: body.proposalId }, include: PROPOSAL_INCLUDE });
  if (!p) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const note = str(body.note, 1000);
  const name = `"${p.application.startupName}"`;

  if (body.action === "withdraw") {
    if (user.userId !== p.investorId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!OPEN_PROPOSAL.includes(p.status)) return NextResponse.json({ error: "This proposal is closed" }, { status: 400 });
    await prisma.investmentProposal.update({ where: { id: p.id }, data: { status: "withdrawn" } });
    await audit(req, user, "proposal.withdraw", "proposal", p.id, `Withdrew the proposal for ${name}`, { status: { from: p.status, to: "withdrawn" } });
    if (p.status === "pitch_scheduled") await notify(p.application.userId, "Pitch cancelled", `${p.investor.name} withdrew before the pitch.`, "warning", p.applicationId);
    await notifyRank(2, "Investment proposal withdrawn", `${p.investor.name} withdrew the proposal for ${name}.`, p.applicationId);
    return NextResponse.json({ success: true, status: "withdrawn" });
  }

  if (!canHandleProposals(user.role)) return NextResponse.json({ error: "Incubation Manager or above handles proposals" }, { status: 403 });
  const by = `${user.name} (${ROLE_LABELS[user.role] ?? user.role})`;

  if (body.action === "schedule_pitch") {
    if (!OPEN_PROPOSAL.includes(p.status)) return NextResponse.json({ error: "This proposal is closed" }, { status: 400 });
    const at = new Date(String(body.pitchAt ?? ""));
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) return NextResponse.json({ error: "Choose a future date and time for the pitch" }, { status: 400 });
    await prisma.investmentProposal.update({ where: { id: p.id }, data: { status: "pitch_scheduled", pitchAt: at, officeNote: note || p.officeNote, handledBy: user.name } });
    await audit(req, user, "proposal.schedule_pitch", "proposal", p.id, `Scheduled the pitch of ${name} to ${p.investor.name} on ${when(at)}`, { status: { from: p.status, to: "pitch_scheduled" } });
    const detail = `${when(at)}${note ? `. ${note}` : ""}`;
    await notify(p.investorId, "Pitch scheduled", `${name} will pitch to you on ${detail}`, "info", p.applicationId, { ctaPath: "/invest", ctaLabel: "View proposal" });
    await notify(p.application.userId, "Investor pitch scheduled 🎯", `The incubation team arranged a pitch to ${p.investor.name} (${p.investor.mentorProfile?.headline ?? "investor"}) on ${detail}`, "success", p.applicationId, { ctaPath: "/dashboard", ctaLabel: "Prepare your pitch" });
    return NextResponse.json({ success: true, status: "pitch_scheduled" });
  }

  if (body.action === "invested" || body.action === "decline") {
    if (!OPEN_PROPOSAL.includes(p.status)) return NextResponse.json({ error: "This proposal is closed" }, { status: 400 });
    if (body.action === "decline" && !note) return NextResponse.json({ error: "Give a reason" }, { status: 400 });
    const status = body.action === "invested" ? "invested" : "declined";
    await prisma.investmentProposal.update({ where: { id: p.id }, data: { status, officeNote: note || p.officeNote, handledBy: user.name } });

    if (status === "invested") {
      // Investors message their portfolio startups through a standing investment connection
      const existing = await prisma.connection.findFirst({ where: { mentorId: p.investorId, incubateeId: p.application.userId, status: "active" } });
      if (!existing) {
        await prisma.connection.create({
          data: {
            incubateeId: p.application.userId, mentorId: p.investorId, applicationId: p.applicationId, type: "investment", status: "active",
            message: `Investment recorded by the office (${p.amount}).`,
            steps: { create: { fromStatus: "new", toStatus: "active", action: "investment recorded", actorId: user.userId, actorName: user.name, actorRole: user.role, remark: note || null } },
          },
        });
      }
    }
    await audit(req, user, `proposal.${body.action}`, "proposal", p.id, `${status === "invested" ? "Recorded investment" : "Closed proposal"}: ${p.investor.name} → ${name} (${p.amount})${note ? ` — ${note}` : ""}`, { status: { from: p.status, to: status } });
    await notify(p.investorId, status === "invested" ? "Investment recorded 🎉" : "Proposal not taken forward",
      status === "invested" ? `${name} is now in your portfolio. You can follow its progress and message the founders.` : `Your proposal for ${name} was not taken forward. ${note}`,
      status === "invested" ? "success" : "warning", p.applicationId, { ctaPath: "/invest", ctaLabel: "Open your portfolio" });
    if (status === "invested")
      await notify(p.application.userId, "Investment recorded 🎉", `${p.investor.name}'s investment (${p.amount}) is recorded. They can now message you from the portal.`, "success", p.applicationId, { ctaPath: "/messages", ctaLabel: "Open messages" });
    return NextResponse.json({ success: true, status });
  }
  return NextResponse.json({ error: `Unknown action. Status is ${PROPOSAL_STATUS[p.status]?.label ?? p.status}.` }, { status: 400 });
}
