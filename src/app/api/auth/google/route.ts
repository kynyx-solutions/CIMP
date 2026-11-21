import { audit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { verifyFirebaseIdToken } from "@/lib/firebase-verify";
import { isCompanyEmail, isPublicRole, isStaffRole } from "@/lib/roles";
import { limitRequest } from "@/lib/ratelimit";

const STAFF_BLOCKED =
  "Google sign-in is not available for staff. Sign in with your company email and password.";

export async function POST(req: NextRequest) {
  try {
    const { idToken, role } = await req.json();
    const limited = limitRequest(req, [{ key: "google-ip:{ip}", limit: 30, windowMs: 900000 }], "sign-in attempts");
    if (limited) return limited;

    if (!idToken) {
      return NextResponse.json({ error: "ID token required" }, { status: 400 });
    }

    // Identity comes only from the verified token, never from the request body.
    let identity;
    try {
      identity = await verifyFirebaseIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid Google sign-in" }, { status: 401 });
    }

    if (!identity.email || !identity.emailVerified) {
      return NextResponse.json(
        { error: "Your Google account email is not verified" },
        { status: 400 },
      );
    }

    if (isCompanyEmail(identity.email)) {
      return NextResponse.json({ error: STAFF_BLOCKED }, { status: 403 });
    }


    let user = await prisma.user.findUnique({ where: { email: identity.email.toLowerCase() } });

    if (user && isStaffRole(user.role)) {
      return NextResponse.json({ error: STAFF_BLOCKED }, { status: 403 });
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: identity.name || identity.email.split("@")[0],
          email: identity.email.toLowerCase(),
          image: identity.picture,
          role: isPublicRole(role) ? role : "incubatee",
          isVerified: true,
          // Google sign-up shows "By continuing you agree to the Terms and Privacy Policy".
          consentAt: new Date(),
        },
      });
      await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.signup", "user", user.id, `Signed up with Google as ${user.role} (consent recorded)`);
    }

    await audit(req, { userId: user.id, name: user.name, role: user.role }, "auth.login", "auth", user.id, "Signed in with Google");

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
    console.error("Google auth error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
