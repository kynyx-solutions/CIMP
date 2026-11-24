import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { limitRequest } from "@/lib/ratelimit";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendOTPEmail } from "@/lib/email";
import { isCompanyEmail, isPublicRole } from "@/lib/roles";

// Helper — generate 6-digit OTP
function generateOTP(): string {
  return randomInt(100000, 1000000).toString(); // cryptographically random
}

// One plain address: no lists, display names or angle brackets (the code email goes to exactly this)
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { role, consent } = body;
  const limited = limitRequest(req, [{ key: "register-ip:{ip}", limit: 10, windowMs: 3600000 }], "sign-ups from this network");
  if (limited) return limited;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!name || !email || !password)
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  if (name.length < 2 || name.length > 80)
    return NextResponse.json({ error: "Name must be 2 to 80 characters" }, { status: 400 });
  if (email.length > 254 || !EMAIL_RE.test(email))
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 8 || password.length > 128)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  // Explicit consent to the Terms and Privacy Policy is required (DPDP Act, PRD WEB-10).
  if (consent !== true)
    return NextResponse.json(
      { error: "Please accept the Terms of Use and Privacy Policy to continue." },
      { status: 400 },
    );

  // Staff (manager / CEO) can never self-register.
  if (role !== undefined && !isPublicRole(role))
    return NextResponse.json(
      { error: "Staff accounts are created by the organisation." },
      { status: 403 },
    );

  if (isCompanyEmail(email))
    return NextResponse.json(
      {
        error:
          "Company email addresses are reserved for staff. Staff accounts are created by the CEO.",
      },
      { status: 403 },
    );


  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 },
    );

  const hashed = await bcrypt.hash(password, 12);
  const otp = generateOTP();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Create user — unverified
  const created = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: isPublicRole(role) ? role : "incubatee",
      isVerified: false,
      otp,
      otpExpiresAt,
      consentAt: new Date(),
    },
  });
  await audit(req, { userId: created.id, name: created.name, role: created.role }, "auth.signup", "user", created.id, `Registered as ${created.role} with email (consent recorded, awaiting OTP)`);

  // Send OTP email (the account exists; the founder can ask for a new code if this fails)
  try {
    await sendOTPEmail(email, name, otp);
  } catch (err) {
    console.error("OTP email failed:", err);
    return NextResponse.json({ error: "We could not send the verification code. Your account is created: open Verify email and use “Resend code” in a minute." }, { status: 503 });
  }

  // Don't set auth cookie yet — send them to verify page instead
  return NextResponse.json({
    success: true,
    requiresVerification: true,
    email,
  });
}
