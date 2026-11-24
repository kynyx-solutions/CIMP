// Leave (BIIF 2.0 HR).
//   GET                         own requests + balances; approvers also get requests waiting on them
//   POST  { type, fromDate, toDate, halfDay, reason }
//   PATCH { id, action: approve|reject|cancel, note }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { ROLE_LABELS } from "@/lib/workflow";
import { HR_MANAGERS, LEAVE_TYPES, canUseHr, istToday, leaveApproverRole, leaveLabel, workingDays } from "@/lib/hr";
import { notify, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

const D = /^\d{4}-\d{2}-\d{2}$/;

async function balances(userId: string) {
  const year = istToday().slice(0, 4);
  const taken = await prisma.leaveRequest.groupBy({ by: ["type"], where: { userId, status: { in: ["approved", "pending"] }, fromDate: { startsWith: year } }, _sum: { days: true } });
  return LEAVE_TYPES.map((t) => {
    const used = taken.find((x) => x.type === t.value)?._sum.days ?? 0;
    return { type: t.value, label: t.label, quota: t.quota, used, left: t.quota === null ? null : t.quota - used };
  });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseHr(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [mine, bal] = await Promise.all([prisma.leaveRequest.findMany({ where: { userId: user.userId }, orderBy: { createdAt: "desc" }, take: 50 }), balances(user.userId)]);
  let toApprove: unknown[] = [];
  if (HR_MANAGERS.includes(user.role)) {
    const pending = await prisma.leaveRequest.findMany({ where: { status: "pending", userId: { not: user.userId } }, orderBy: { fromDate: "asc" } });
    toApprove = withId(pending.filter((l) => leaveApproverRole(l.userRole) === user.role || user.role === "ceo"));
  }
  const upcoming = HR_MANAGERS.includes(user.role) ? withId(await prisma.leaveRequest.findMany({ where: { status: "approved", toDate: { gte: istToday() } }, orderBy: { fromDate: "asc" }, take: 20 })) : [];
  return NextResponse.json({ mine: withId(mine), balances: bal, toApprove, upcoming, approverRole: leaveApproverRole(user.role) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseHr(user.role)) return NextResponse.json({ error: "Only office users apply for leave" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!LEAVE_TYPES.some((t) => t.value === b.type)) return NextResponse.json({ error: "Choose a leave type" }, { status: 400 });
  if (!D.test(b.fromDate ?? "") || !D.test(b.toDate ?? "")) return NextResponse.json({ error: "Choose the dates" }, { status: 400 });
  if (b.toDate < b.fromDate) return NextResponse.json({ error: "The end date is before the start date" }, { status: 400 });
  if (b.fromDate < istToday() && b.type !== "sick") return NextResponse.json({ error: "Only sick leave can start in the past" }, { status: 400 });
  const days = workingDays(b.fromDate, b.toDate, b.halfDay === true);
  if (days <= 0) return NextResponse.json({ error: "Those dates have no working days (Sunday is off)" }, { status: 400 });
  if (days > 30) return NextResponse.json({ error: "Apply for at most 30 working days at a time" }, { status: 400 });
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 1000) : "";
  if (!reason) return NextResponse.json({ error: "Give a reason" }, { status: 400 });
  const overlap = await prisma.leaveRequest.findFirst({ where: { userId: user.userId, status: { in: ["pending", "approved"] }, fromDate: { lte: b.toDate }, toDate: { gte: b.fromDate } } });
  if (overlap) return NextResponse.json({ error: "You already have leave on some of these dates" }, { status: 409 });
  const bal = (await balances(user.userId)).find((x) => x.type === b.type)!;
  if (bal.left !== null && days > bal.left) return NextResponse.json({ error: `Only ${bal.left} day${bal.left === 1 ? "" : "s"} of ${bal.label.toLowerCase()} left this year` }, { status: 400 });

  const approver = leaveApproverRole(user.role);
  const l = await prisma.leaveRequest.create({
    data: { userId: user.userId, userName: user.name, userRole: user.role, type: b.type, fromDate: b.fromDate, toDate: b.toDate, days, reason,
      ...(approver ? {} : { status: "approved", approverId: user.userId, approverName: user.name, decisionNote: "Recorded by the CEO", decidedAt: new Date() }) },
  });
  await audit(req, user, "leave.apply", "leave", l.id, `Applied for ${days} day(s) of ${leaveLabel(b.type).toLowerCase()}, ${b.fromDate} to ${b.toDate}`);
  if (approver) {
    const ids = (await prisma.user.findMany({ where: { role: approver }, select: { id: true } })).map((u) => u.id);
    await notifyUsers(ids, "Leave request to approve", `${user.name} (${ROLE_LABELS[user.role] ?? user.role}): ${days} day(s) of ${leaveLabel(b.type).toLowerCase()}, ${b.fromDate} to ${b.toDate}.`, "info", undefined, { ctaPath: "/hr", ctaLabel: "Review leave" });
  }
  return NextResponse.json({ success: true, leave: withId(l) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseHr(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, action, note } = await req.json().catch(() => ({}));
  if (!isId(id) || !["approve", "reject", "cancel"].includes(action)) return NextResponse.json({ error: "id and action required" }, { status: 400 });
  const l = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!l) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cleanNote = typeof note === "string" ? note.trim().slice(0, 500) : "";

  if (action === "cancel") {
    if (l.userId !== user.userId) return NextResponse.json({ error: "Only the applicant can cancel" }, { status: 403 });
    if (!["pending", "approved"].includes(l.status) || l.fromDate <= istToday()) return NextResponse.json({ error: "Only future leave can be cancelled" }, { status: 400 });
    const { count } = await prisma.leaveRequest.updateMany({ where: { id: l.id, status: l.status }, data: { status: "cancelled" } });
    if (!count) return NextResponse.json({ error: "This leave changed just now. Reload to see it." }, { status: 409 });
    await audit(req, user, "leave.cancel", "leave", l.id, `Cancelled leave ${l.fromDate} to ${l.toDate}`, { status: { from: l.status, to: "cancelled" } });
    return NextResponse.json({ success: true });
  }
  if (l.userId === user.userId) return NextResponse.json({ error: "You cannot decide your own leave" }, { status: 403 });
  const approver = leaveApproverRole(l.userRole);
  if (!(user.role === approver || user.role === "ceo")) return NextResponse.json({ error: "Your role does not approve this leave" }, { status: 403 });
  if (l.status !== "pending") return NextResponse.json({ error: "This request is already decided" }, { status: 400 });
  if (action === "reject" && !cleanNote) return NextResponse.json({ error: "Give a reason" }, { status: 400 });
  const status = action === "approve" ? "approved" : "rejected";
  const { count } = await prisma.leaveRequest.updateMany({ where: { id: l.id, status: "pending" }, data: { status, approverId: user.userId, approverName: user.name, decisionNote: cleanNote || null, decidedAt: new Date() } });
  if (!count) return NextResponse.json({ error: "This request was decided just now. Reload to see the decision." }, { status: 409 });
  await audit(req, user, `leave.${action}`, "leave", l.id, `${status === "approved" ? "Approved" : "Rejected"} ${l.userName}'s ${leaveLabel(l.type).toLowerCase()} (${l.fromDate} to ${l.toDate})${cleanNote ? ` — ${cleanNote}` : ""}`, { status: { from: "pending", to: status } });
  await notify(l.userId, status === "approved" ? "Leave approved" : "Leave not approved", `${leaveLabel(l.type)} ${l.fromDate} to ${l.toDate}${cleanNote ? `: ${cleanNote}` : "."}`, status === "approved" ? "success" : "warning", undefined, { ctaPath: "/hr", ctaLabel: "Open HR" });
  return NextResponse.json({ success: true, status });
}
