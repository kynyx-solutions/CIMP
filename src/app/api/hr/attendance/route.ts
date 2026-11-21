// Attendance (BIIF 2.0 HR).
//   GET ?month=YYYY-MM          own month; CEO / Sr Manager: ?team=1&date=YYYY-MM-DD for everyone that day
//   POST { action: check_in|check_out, mode, note }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId } from "@/lib/serialize";
import { OFFICE_ROLES } from "@/lib/workflow";
import { ATTENDANCE_MODES, HR_MANAGERS, canUseHr, istToday, isLate } from "@/lib/hr";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseHr(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const today = istToday();
  if (p.get("team") === "1") {
    if (!HR_MANAGERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(p.get("date") ?? "") ? p.get("date")! : today;
    const [staff, rows, onLeave] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: [...OFFICE_ROLES] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
      prisma.attendance.findMany({ where: { date } }),
      prisma.leaveRequest.findMany({ where: { status: "approved", fromDate: { lte: date }, toDate: { gte: date } }, select: { userId: true, type: true } }),
    ]);
    const team = staff.map((s) => {
      const r = rows.find((x) => x.userId === s.id), l = onLeave.find((x) => x.userId === s.id);
      return { userId: s.id, name: s.name, role: s.role, record: r ? { ...withId(r), late: isLate(r.checkIn) } : null, leave: l?.type ?? null };
    });
    return NextResponse.json({ date, team, summary: { present: team.filter((t) => t.record).length, late: team.filter((t) => t.record?.late).length, onLeave: team.filter((t) => t.leave).length, absent: team.filter((t) => !t.record && !t.leave).length } });
  }
  const month = /^\d{4}-\d{2}$/.test(p.get("month") ?? "") ? p.get("month")! : today.slice(0, 7);
  const rows = await prisma.attendance.findMany({ where: { userId: user.userId, date: { startsWith: month } }, orderBy: { date: "desc" } });
  return NextResponse.json({ today, month, todayRecord: rows.find((r) => r.date === today) ?? null, records: withId(rows).map((r: any) => ({ ...r, late: isLate(r.checkIn) })), canSeeTeam: HR_MANAGERS.includes(user.role) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !canUseHr(user.role)) return NextResponse.json({ error: "Only office users mark attendance" }, { status: 403 });
  const { action, mode, note } = await req.json().catch(() => ({}));
  const date = istToday();
  const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: user.userId, date } } });
  if (action === "check_in") {
    if (existing) return NextResponse.json({ error: "You have already checked in today" }, { status: 409 });
    if (!ATTENDANCE_MODES.some((m) => m.value === mode)) return NextResponse.json({ error: "Choose office, work from home or field visit" }, { status: 400 });
    const r = await prisma.attendance.create({ data: { userId: user.userId, userName: user.name, date, checkIn: new Date(), mode, note: typeof note === "string" ? note.trim().slice(0, 200) || null : null } });
    await audit(req, user, "attendance.check_in", "attendance", r.id, `Checked in (${mode}) on ${date}${isLate(r.checkIn) ? " — late" : ""}`);
    return NextResponse.json({ success: true, record: withId(r) }, { status: 201 });
  }
  if (action === "check_out") {
    if (!existing) return NextResponse.json({ error: "Check in first" }, { status: 400 });
    if (existing.checkOut) return NextResponse.json({ error: "You have already checked out today" }, { status: 409 });
    const r = await prisma.attendance.update({ where: { id: existing.id }, data: { checkOut: new Date() } });
    const hours = ((r.checkOut!.getTime() - r.checkIn.getTime()) / 3600_000).toFixed(1);
    await audit(req, user, "attendance.check_out", "attendance", r.id, `Checked out on ${date} after ${hours} h`);
    return NextResponse.json({ success: true, record: withId(r) });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
