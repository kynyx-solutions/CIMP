import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, type Role } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();

  if (!email || !otp)
    return NextResponse.json(
      { error: "Email and OTP required" },
      { status: 400 },
    );

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.isVerified)
    return NextResponse.json({ error: "Already verified" }, { status: 400 });

  if (!user.otp || user.otp !== otp)
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });

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

  await sendWelcomeEmail(user.email, user.name, user.role);

  // Now issue JWT and log them in
  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set("incubator_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
