// Mentor directory for signed-in users, and profile review for the office (PRD 6.2).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { isOfficeRole } from "@/lib/workflow";
import { canReviewMentor, canReviewInvestor } from "@/lib/network";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { emitEvent } from "@/lib/integrations";

// GET — incubatees/mentors: approved mentors (no emails). Office: all profiles with contact.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const office = isOfficeRole(user.role);
  if (office) {
    const profiles = await prisma.mentorProfile.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ profiles: withId(profiles) });
  }
  // Founders and mentors see the directory card only: no review notes, reviewer or custom answers
  const profiles = await prisma.mentorProfile.findMany({
    where: { status: "approved" },
    select: {
      id: true, userId: true, headline: true, organisation: true, expertise: true, sectors: true, bio: true,
      linkedin: true, yearsExperience: true, status: true, investorStatus: true, investorThesis: true, ticketSize: true,
      createdAt: true, updatedAt: true, user: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ profiles: withId(profiles) });
}

// POST — office review: { profileId, kind: "mentor" | "investor", decision: "approve" | "reject", note }
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !isOfficeRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { profileId, kind, decision, note } = await req.json();
  if (!isId(profileId) || !["mentor", "investor"].includes(kind) || !["approve", "reject"].includes(decision))
    return NextResponse.json({ error: "profileId, kind and decision are required" }, { status: 400 });
  const cleanNote = typeof note === "string" ? note.trim().slice(0, 1000) : "";
  if (decision === "reject" && !cleanNote) return NextResponse.json({ error: "A reason is required to reject" }, { status: 400 });

  if (kind === "mentor" ? !canReviewMentor(user.role) : !canReviewInvestor(user.role))
    return NextResponse.json({ error: "Your role cannot review this" }, { status: 403 });

  const profile = await prisma.mentorProfile.findUnique({ where: { id: profileId } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const approved = decision === "approve";
  if (kind === "mentor") {
    if (profile.status !== "submitted") return NextResponse.json({ error: "This profile is not waiting for review" }, { status: 400 });
    await prisma.mentorProfile.update({
      where: { id: profile.id },
      data: { status: approved ? "approved" : "rejected", reviewNote: cleanNote || null, reviewedBy: user.name },
    });
    if (approved && profile.isPublic) await emitEvent("mentor.approved", { id: profile.id, headline: profile.headline, sectors: profile.sectors });
    await notify(profile.userId,
      approved ? "Mentor profile approved 🎉" : "Mentor profile not approved",
      approved ? "Your mentor profile is approved and listed in the CIMP-BIIF network." : `Your mentor profile was not approved. Reason: ${cleanNote}`,
      approved ? "success" : "error", undefined, { ctaPath: "/mentor", ctaLabel: "Open your Mentor hub" });
  } else {
    if (profile.investorStatus !== "submitted") return NextResponse.json({ error: "No investor application waiting for review" }, { status: 400 });
    await prisma.mentorProfile.update({
      where: { id: profile.id },
      data: { investorStatus: approved ? "approved" : "rejected", investorNote: cleanNote || null },
    });
    await notify(profile.userId,
      approved ? "Investor listing approved 🎉" : "Investor application not approved",
      approved ? "You are now also listed as an investor." : `Your investor application was not approved. Reason: ${cleanNote}`,
      approved ? "success" : "error", undefined, { ctaPath: "/mentor", ctaLabel: "Open your Mentor hub" });
  }
  await audit(req, user, `mentor_profile.${kind}_${decision}`, "mentor_profile", profile.id,
    `${decision === "approve" ? "Approved" : "Did not approve"} ${kind} listing${cleanNote ? ` (note: ${cleanNote})` : ""}`,
    { [kind === "mentor" ? "status" : "investorStatus"]: { from: kind === "mentor" ? profile.status : profile.investorStatus, to: approved ? "approved" : "rejected" } });
  return NextResponse.json({ success: true });
}
