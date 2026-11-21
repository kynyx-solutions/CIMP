import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from "crypto";
import { limitRequest } from "@/lib/ratelimit";
import { prisma } from "@/lib/prisma";
import { sendOTPEmail } from '@/lib/email';

function generateOTP(): string {
  return randomInt(100000, 1000000).toString(); // cryptographically random
}

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  // Each resend sends an email: 3 per address and 10 per IP address in 15 minutes.
  const limited = limitRequest(req, [{ key: `resend:${String(email).toLowerCase()}`, limit: 3, windowMs: 900000 }, { key: "resend-ip:{ip}", limit: 10, windowMs: 900000 }], "code requests");
  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user)        return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.isVerified) return NextResponse.json({ error: 'Already verified' }, { status: 400 });

  const otp = generateOTP();
  await prisma.user.update({
    where: { id: user.id },
    data: { otp, otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  try {
    await sendOTPEmail(email, user.name, otp);
  } catch (err) {
    console.error("OTP email failed:", err);
    return NextResponse.json({ error: "We could not send the verification code. Please use “Resend code” in a minute." }, { status: 503 });
  }
  return NextResponse.json({ success: true });
}