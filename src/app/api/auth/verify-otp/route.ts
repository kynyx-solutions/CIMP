import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimit, resetLimit, limitRequest } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const otp = body.otp;

  if (!email || !otp)
    return NextResponse.json(
      { error: "Email and OTP required" },
      { status: 400 },
    );

  const ipLimited = limitRequest(req, [{ key: "otp-ip:{ip}", limit: 30, windowMs: 900000 }], "attempts");
  if (ipLimited) return ipLimited;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Unknown and already-verified addresses get the wrong-code answer (no account discovery)
  if (!user || user.isVerified)
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });

  if (!user.otp || user.otp !== String(otp)) {
    // A 6-digit code allows only 5 wrong tries; then the code is cancelled and a new one is needed.
    const key = `otp:${user.id}`;
    const r = rateLimit(key, 4, 900000);
    if (!r.ok) {
      await prisma.user.update({ where: { id: user.id }, data: { otp: null, otpExpiresAt: null } });
      resetLimit(key);
      return NextResponse.json({ error: "Too many wrong codes. That code is cancelled: request a new one." }, { status: 429 });
    }
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }
  resetLimit(`otp:${user.id}`);

  if (!user.otpExpiresAt || user.otpExpiresAt < new Date())
    return NextResponse.json(
      { error: "OTP expired. Request a new one." },
      { status: 400 },
    );

  // Mark verified, clear OTP
  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, otp: null, otpExpiresAt: null },
  });

  await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.verify_email", "user", user.id, "Verified email with OTP");

  // The account is verified either way; a mail problem must not fail the sign-in
  try {
    await sendWelcomeEmail(user.email, user.name, user.role);
  } catch (err) {
    console.error("Welcome email failed:", err);
  }

  // Sign them in
  const response = NextResponse.json({ success: true });
  await startSession(response, req, user);

  return response;
}
