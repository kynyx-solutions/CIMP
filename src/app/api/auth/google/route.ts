import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signToken } from "@/lib/auth";
import { verifyFirebaseIdToken } from "@/lib/firebase-verify";
import { isCompanyEmail, isPublicRole, isStaffRole } from "@/lib/roles";

const STAFF_BLOCKED =
  "Google sign-in is not available for staff. Sign in with your company email and password.";

export async function POST(req: NextRequest) {
  try {
    const { idToken, role } = await req.json();

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

    await connectDB();

    let user = await User.findOne({ email: identity.email.toLowerCase() });

    if (user && isStaffRole(user.role)) {
      return NextResponse.json({ error: STAFF_BLOCKED }, { status: 403 });
    }

    if (!user) {
      user = await User.create({
        name: identity.name || identity.email.split("@")[0],
        email: identity.email,
        image: identity.picture,
        role: isPublicRole(role) ? role : "incubatee",
        isVerified: true,
      });
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id,
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
    console.error("Google auth error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
