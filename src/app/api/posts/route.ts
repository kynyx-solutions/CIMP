// Blog posts (PRD BLG-1).
//   GET                                       staff: own posts · Admin IT: all posts
//   POST  { title, excerpt, body, submit }    write a post (staff, Admin IT)
//   PUT   { postId, title, excerpt, body, submit }   edit own draft or returned post
//   PATCH { postId, action: publish|reject|unpublish, note }   Admin IT
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { withId, isId } from "@/lib/serialize";
import { BLOG_WRITERS, slugify } from "@/lib/blog";
import { notify, notifyUsers } from "@/lib/notify";
import { audit } from "@/lib/audit";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parse(body: any) {
  const title = str(body.title, 140), excerpt = str(body.excerpt, 300), text = typeof body.body === "string" ? body.body.trim().slice(0, 20000) : "";
  if (title.length < 5) return { error: "Give the post a title (at least 5 characters)" };
  if (excerpt.length < 10) return { error: "Write a one or two sentence summary" };
  if (text.length < 50) return { error: "The post is too short" };
  return { data: { title, excerpt, body: text } };
}

async function uniqueSlug(title: string, exceptId?: string) {
  const base = slugify(title);
  let slug = base, n = 2;
  while (await prisma.blogPost.findFirst({ where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) slug = `${base}-${n++}`;
  return slug;
}

async function notifyAdmins(title: string) {
  const admins = await prisma.user.findMany({ where: { role: "admin_it" }, select: { id: true } });
  await notifyUsers(admins.map((a) => a.id), "Blog post to approve", `"${title}" is waiting for approval.`, "info", undefined, { ctaPath: "/posts", ctaLabel: "Review the post" });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !BLOG_WRITERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const posts = await prisma.blogPost.findMany({ where: user.role === "admin_it" ? {} : { authorId: user.userId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ posts: withId(posts), canPublish: user.role === "admin_it" });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !BLOG_WRITERS.includes(user.role)) return NextResponse.json({ error: "Only Office Staff and Admin IT write posts" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const p = parse(body);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  const submit = body.submit === true;
  const post = await prisma.blogPost.create({ data: { ...p.data!, slug: await uniqueSlug(p.data!.title), authorId: user.userId, authorName: user.name, status: submit ? "submitted" : "draft" } });
  await audit(req, user, submit ? "blog.submit" : "blog.create", "blog", post.id, `${submit ? "Submitted" : "Drafted"} blog post "${post.title}"`);
  if (submit) await notifyAdmins(post.title);
  return NextResponse.json({ success: true, post: withId(post) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !BLOG_WRITERS.includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!isId(body.postId)) return NextResponse.json({ error: "postId required" }, { status: 400 });
  const post = await prisma.blogPost.findUnique({ where: { id: body.postId } });
  if (!post || post.authorId !== user.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["draft", "rejected"].includes(post.status)) return NextResponse.json({ error: "This post is with Admin IT or already published" }, { status: 400 });
  const p = parse(body);
  if (p.error) return NextResponse.json({ error: p.error }, { status: 400 });
  const submit = body.submit === true;
  const updated = await prisma.blogPost.update({
    where: { id: post.id },
    data: { ...p.data!, slug: p.data!.title !== post.title ? await uniqueSlug(p.data!.title, post.id) : post.slug, status: submit ? "submitted" : post.status },
  });
  await audit(req, user, submit ? "blog.submit" : "blog.edit", "blog", post.id, `${submit ? "Submitted" : "Edited"} blog post "${updated.title}"`);
  if (submit) await notifyAdmins(updated.title);
  return NextResponse.json({ success: true, post: withId(updated) });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin_it") return NextResponse.json({ error: "Only Admin IT approves posts" }, { status: 403 });
  const { postId, action, note } = await req.json().catch(() => ({}));
  if (!isId(postId) || !["publish", "reject", "unpublish"].includes(action)) return NextResponse.json({ error: "postId and action required" }, { status: 400 });
  const post = await prisma.blogPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cleanNote = str(note, 1000);

  if (action === "publish") {
    if (post.status !== "submitted" && !(post.status === "draft" && post.authorId === user.userId)) return NextResponse.json({ error: "Only submitted posts can be published" }, { status: 400 });
    await prisma.blogPost.update({ where: { id: post.id }, data: { status: "published", publishedAt: new Date(), reviewedBy: user.name, reviewNote: null } });
  } else if (action === "reject") {
    if (post.status !== "submitted") return NextResponse.json({ error: "Only submitted posts can be sent back" }, { status: 400 });
    if (!cleanNote) return NextResponse.json({ error: "Tell the author what to change" }, { status: 400 });
    await prisma.blogPost.update({ where: { id: post.id }, data: { status: "rejected", reviewedBy: user.name, reviewNote: cleanNote } });
  } else {
    if (post.status !== "published") return NextResponse.json({ error: "Not published" }, { status: 400 });
    await prisma.blogPost.update({ where: { id: post.id }, data: { status: "draft", publishedAt: null, reviewedBy: user.name, reviewNote: cleanNote || "Unpublished by Admin IT" } });
  }
  revalidatePath("/blog"); revalidatePath(`/blog/${post.slug}`);
  await audit(req, user, `blog.${action}`, "blog", post.id, `${action === "publish" ? "Published" : action === "reject" ? "Sent back" : "Unpublished"} blog post "${post.title}"${cleanNote ? ` (note: ${cleanNote})` : ""}`);
  if (post.authorId !== user.userId)
    await notify(post.authorId, action === "publish" ? "Your post is live" : action === "reject" ? "Post needs changes" : "Post unpublished",
      action === "publish" ? `"${post.title}" is published on the CIMP-BIIF blog.` : `"${post.title}": ${cleanNote || "unpublished by Admin IT."}`,
      action === "publish" ? "success" : "warning", undefined, { ctaPath: action === "publish" ? `/blog/${post.slug}` : "/posts", ctaLabel: action === "publish" ? "Read it" : "Edit the post" });
  return NextResponse.json({ success: true });
}
