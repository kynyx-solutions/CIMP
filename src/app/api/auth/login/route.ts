import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, type Role } from "@/lib/auth";
import { isCompanyEmail, isStaffRole } from "@/lib/roles";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: "This account uses Google sign-in. Continue with Google." },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.login_failed", "auth", user.id, "Failed sign-in (wrong password)");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
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

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });

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

    response.cookies.set("incubator_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
