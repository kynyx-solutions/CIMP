// Email settings check (PRD NOT-1): which delivery is configured, and a test email to yourself.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { fromAddress, mailMode, sendEventEmail, verifyMail } from "@/lib/email";
import { audit } from "@/lib/audit";

const ALLOWED = ["admin_it", "ceo"];

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const mode = mailMode();
  const since = new Date(Date.now() - 7 * 864e5);
  const emailed = await prisma.auditLog.count({ where: { action: "email.test", at: { gte: since } } });
  return NextResponse.json({
    mode, from: fromAddress(),
    server: mode === "smtp" ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}` : mode === "gmail" ? "Gmail (smtp.gmail.com)" : null,
    testsThisWeek: emailed,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !ALLOWED.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { email: true, name: true } });
  if (!me) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const mode = mailMode();
  try {
    if (mode !== "log") await verifyMail();
    await sendEventEmail({ to: me.email, name: me.name, title: "Test email from the CIMP-BIIF portal", message: `This confirms the portal can send email (${mode === "smtp" ? "SMTP" : mode === "gmail" ? "Gmail" : "terminal log only"}).`, type: "success", ctaPath: "/admin?tab=email", ctaLabel: "Back to settings" });
  } catch (err) {
    const reason = String((err as Error)?.message ?? err).slice(0, 300);
    await audit(req, user, "email.test_failed", "notification", null, `Test email to ${me.email} failed: ${reason}`);
    return NextResponse.json({ error: `Could not send: ${reason}`, mode }, { status: 502 });
  }
  await audit(req, user, "email.test", "notification", null, `Sent a test email to ${me.email} (${mode})`);
  return NextResponse.json({ success: true, mode, to: me.email });
}
