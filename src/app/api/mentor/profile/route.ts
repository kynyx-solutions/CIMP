// Mentor's own profile (PRD MEN-1) and investor application (PRD MEN-2).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId } from "@/lib/serialize";
import { INDUSTRIES } from "@/lib/application-fields";
import { notifyRank } from "@/lib/notify";
import { audit, diffOf } from "@/lib/audit";
import { MENTOR_REVIEW_RANK, INVESTOR_REVIEW_RANK } from "@/lib/network";
import { customFields, validateFields } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";
import type { Prisma } from "@prisma/client";

function requireMentor(req: NextRequest) {
  const user = getSessionUser(req);
  return user?.role === "mentor" ? user : null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parseProfile(body: Record<string, unknown>) {
  const headline = str(body.headline, 120);
  const expertise = str(body.expertise, 600);
  const sectors = Array.isArray(body.sectors) ? body.sectors.filter((s): s is string => typeof s === "string" && INDUSTRIES.includes(s)) : [];
  const linkedin = str(body.linkedin, 200);
  const years = body.yearsExperience === "" || body.yearsExperience == null ? null : Number(body.yearsExperience);

  if (!headline) return { error: "Headline is required (e.g. “Former CXO, FinTech”)" };
  if (!expertise) return { error: "Describe your areas of expertise" };
  if (sectors.length === 0) return { error: "Choose at least one sector" };
  if (linkedin && !/^https?:\/\/\S+\.\S+/.test(linkedin)) return { error: "LinkedIn link must start with http:// or https://" };
  if (years != null && (!Number.isInteger(years) || years < 0 || years > 60)) return { error: "Years of experience must be between 0 and 60" };

  return {
    data: {
      headline, expertise, sectors, linkedin: linkedin || null,
      organisation: str(body.organisation, 120) || null,
      bio: str(body.bio, 2000) || null,
      yearsExperience: years,
      isPublic: body.isPublic !== false,
    },
  };
}

// GET — own profile (or null)
export async function GET(req: NextRequest) {
  const user = requireMentor(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const profile = await prisma.mentorProfile.findUnique({ where: { userId: user.userId } });
  return NextResponse.json({ profile: profile ? withId(profile) : null });
}

// PUT — save profile; { submit: true } also sends it for office review
export async function PUT(req: NextRequest) {
  const user = requireMentor(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = parseProfile(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // Extra fields Admin IT added to the mentor form (PRD FORM-1), stored in answers
  const form = await getForm("mentor");
  const extra = validateFields(customFields(form), (body.answers && typeof body.answers === "object") ? body.answers : {});
  if (extra.error) return NextResponse.json({ error: extra.error }, { status: 400 });
  const answers = extra.data as Prisma.InputJsonValue;

  const existing = await prisma.mentorProfile.findUnique({ where: { userId: user.userId } });
  const submit = body.submit === true && (!existing || existing.status === "draft" || existing.status === "rejected");

  const profile = await prisma.mentorProfile.upsert({
    where: { userId: user.userId },
    create: { ...parsed.data!, answers, userId: user.userId, status: submit ? "submitted" : "draft" },
    update: { ...parsed.data!, answers, ...(submit ? { status: "submitted", reviewNote: null } : {}) },
  });

  await audit(req, user, submit ? "mentor_profile.submit" : existing ? "mentor_profile.edit" : "mentor_profile.create", "mentor_profile", profile.id,
    submit ? "Submitted mentor profile for review" : "Saved mentor profile",
    existing ? diffOf(existing, profile, ["headline", "organisation", "expertise", "sectors", "bio", "linkedin", "yearsExperience", "isPublic", "answers", "status"]) : null);

  if (submit) {
    await notifyRank(MENTOR_REVIEW_RANK, "New mentor profile", `${user.name} submitted a mentor profile for review.`, undefined, { ctaPath: "/network", ctaLabel: "Review profile" });
  }
  return NextResponse.json({ success: true, profile: withId(profile) });
}

// POST — apply to also be listed as an investor (approved mentors only)
export async function POST(req: NextRequest) {
  const user = requireMentor(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const thesis = str(body.investorThesis, 1500);
  const ticketSize = str(body.ticketSize, 80);
  if (!thesis) return NextResponse.json({ error: "Describe your investment focus" }, { status: 400 });
  if (!ticketSize) return NextResponse.json({ error: "Give a typical ticket size" }, { status: 400 });

  const profile = await prisma.mentorProfile.findUnique({ where: { userId: user.userId } });
  if (!profile || profile.status !== "approved")
    return NextResponse.json({ error: "Your mentor profile must be approved first" }, { status: 400 });
  if (profile.investorStatus === "submitted" || profile.investorStatus === "approved")
    return NextResponse.json({ error: "Investor application already submitted" }, { status: 409 });

  const updated = await prisma.mentorProfile.update({
    where: { id: profile.id },
    data: { investorThesis: thesis, ticketSize, investorStatus: "submitted", investorNote: null },
  });
  await audit(req, user, "mentor_profile.investor_apply", "mentor_profile", profile.id, `Applied to be listed as an investor (ticket ${ticketSize})`);
  await notifyRank(INVESTOR_REVIEW_RANK, "New investor application", `${user.name} applied to be listed as an investor.`, undefined, { ctaPath: "/network", ctaLabel: "Review application" });
  return NextResponse.json({ success: true, profile: withId(updated) });
}
