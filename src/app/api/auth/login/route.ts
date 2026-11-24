import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { isCompanyEmail, isStaffRole } from "@/lib/roles";
import { limitRequest, resetLimit } from "@/lib/ratelimit";

// bcrypt hash of a random string, compared against when the address has no password
const DUMMY_HASH = "$2a$12$eAtN4matXXKMR0UYuJIx5ulANJ7hW0UJywjqmKR5WZ3/mHfNxeuye";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    // Brute-force protection: 10 tries per account and 30 per IP address in 15 minutes.
    const acct = `login:${String(email ?? "").toLowerCase()}`;
    const limited = limitRequest(req, [{ key: acct, limit: 10, windowMs: 900000 }, { key: "login-ip:{ip}", limit: 30, windowMs: 900000 }], "sign-in attempts");
    if (limited) return limited;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Unknown address, Google-only account and wrong password all get the same answer, and an
    // unknown address still costs one bcrypt comparison (no account discovery by timing).
    const invalid = () => NextResponse.json({ error: "Invalid email or password. If you signed up with Google, use Continue with Google." }, { status: 401 });
    if (!user?.password) {
      await bcrypt.compare(String(password), DUMMY_HASH);
      return invalid();
    }

    const valid = await bcrypt.compare(String(password), user.password);
    if (!valid) {
      await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.login_failed", "auth", user.id, "Failed sign-in (wrong password)");
      return invalid();
    }

    // Staff may only sign in with a company-domain email.
    if (isStaffRole(user.role) && !isCompanyEmail(user.email)) {
      return NextResponse.json(
        { error: "Staff must sign in with a company email address." },
        { status: 403 },
      );
    }

    if (!user.isVerified) {
      return NextResponse.json(
        {
          error: "Please verify your email first.",
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 },
      );
    }

    resetLimit(acct);
    await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.login", "auth", user.id, "Signed in with email and password");

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
    await startSession(response, req, user);

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
