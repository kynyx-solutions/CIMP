// Social media content calendar (BIIF 2.0 social media manager dashboard).
//   GET                                          posts (Social Media Manager, Admin IT, CEO)
//   POST  { platforms, content, scheduledFor }   draft or schedule (Social Media Manager, Admin IT)
//   PUT   { id, platforms, content, scheduledFor }   edit an unpublished post
//   PATCH { id, action: "publish", links } | { id, action: "unschedule" }
// Posting itself happens on each platform; the portal plans, records links and keeps the history.
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { PLATFORMS, SOCIAL_ROLES } from "@/lib/hr";
import { audit } from "@/lib/audit";

const editors = ["social_media", "admin_it"];

function parse(b: any) {
  const platforms = Array.isArray(b.platforms) ? PLATFORMS.map((p) => p.value).filter((p) => b.platforms.includes(p)) : [];
  if (!platforms.length) return { error: "Choose at least one platform" };
  const content = typeof b.content === "string" ? b.content.trim().slice(0, 3000) : "";
  if (content.length < 10) return { error: "Write the post (at least 10 characters)" };
  if (platforms.includes("x") && content.length > 280) return { error: `X allows 280 characters; this post has ${content.length}` };
  let scheduledFor: Date | null = null;
  if (b.scheduledFor) {
    scheduledFor = new Date(String(b.scheduledFor));
    if (Number.isNaN(scheduledFor.getTime())) return { error: "Enter a valid date and time" };
  }
  return { data: { platforms, content, scheduledFor, status: scheduledFor ? "scheduled" : "draft" } };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !SOCIAL_ROLES.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const posts = await prisma.socialPost.findMany({ orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }], take: 200 });
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const publishedThisMonth = posts.filter((p) => p.status === "published" && p.updatedAt >= monthStart);
  return NextResponse.json({
    posts: withId(posts), canEdit: editors.includes(user.role),
    stats: Object.fromEntries(PLATFORMS.map((pl) => [pl.value, publishedThisMonth.filter((p) => p.platforms.includes(pl.value)).length])),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !editors.includes(user.role)) return NextResponse.json({ error: "Only the Social Media Manager and Admin IT plan posts" }, { status: 403 });
  const p = parse(await req.json().catch(() => ({})));
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  const post = await prisma.socialPost.create({ data: { ...p.data!, createdById: user.userId, createdBy: user.name } });
  await audit(req, user, "social.create", "social", post.id, `${post.status === "scheduled" ? "Scheduled" : "Drafted"} a ${post.platforms.join("/")} post`);
  return NextResponse.json({ success: true, post: withId(post) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !editors.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!isId(b.id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const before = await prisma.socialPost.findUnique({ where: { id: b.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (before.status === "published") return NextResponse.json({ error: "Published posts cannot be edited" }, { status: 400 });
  const p = parse(b);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  await prisma.socialPost.update({ where: { id: before.id }, data: p.data! });
  await audit(req, user, "social.edit", "social", before.id, `Edited a ${p.data!.platforms.join("/")} post`);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !editors.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!isId(b.id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  const post = await prisma.socialPost.findUnique({ where: { id: b.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (b.action === "publish") {
    if (post.status === "published") return NextResponse.json({ error: "Already published" }, { status: 400 });
    const links: Record<string, string> = {};
    for (const pl of post.platforms) {
      const v = typeof b.links?.[pl] === "string" ? b.links[pl].trim() : "";
      if (v && !/^https:\/\/\S+\.\S+/.test(v)) return NextResponse.json({ error: `The ${pl} link must start with https://` }, { status: 400 });
      if (v) links[pl] = v.slice(0, 300);
    }
    await prisma.socialPost.update({ where: { id: post.id }, data: { status: "published", publishedLinks: links as Prisma.InputJsonValue } });
    await audit(req, user, "social.publish", "social", post.id, `Marked a ${post.platforms.join("/")} post as published`);
    return NextResponse.json({ success: true });
  }
  if (b.action === "unschedule") {
    if (post.status !== "scheduled") return NextResponse.json({ error: "Not scheduled" }, { status: 400 });
    await prisma.socialPost.update({ where: { id: post.id }, data: { status: "draft", scheduledFor: null } });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
