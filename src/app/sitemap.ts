import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public pages only; portal pages are excluded (and marked noindex). Published blog posts,
// public startup profiles and public mentor profiles are listed individually.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pages = ["", "/about", "/programs", "/how-to-apply", "/startups", "/mentors", "/facilities", "/schemes", "/blog", "/faq", "/privacy", "/terms", "/register", "/login"]
    .map((p) => ({ url: `${base}${p}`, changeFrequency: (["/startups", "/blog"].includes(p) ? "daily" : "monthly") as "daily" | "monthly" }));
  try {
    const [posts, startups, mentors] = await Promise.all([
      prisma.blogPost.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } }),
      prisma.application.findMany({ where: { isPublic: true, status: "approved" }, select: { id: true, updatedAt: true } }),
      prisma.mentorProfile.findMany({ where: { status: "approved", isPublic: true }, select: { id: true, updatedAt: true } }),
    ]);
    return [
      ...pages,
      ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt })),
      ...startups.map((s) => ({ url: `${base}/startups/${s.id}`, lastModified: s.updatedAt })),
      ...mentors.map((m) => ({ url: `${base}/mentors/${m.id}`, lastModified: m.updatedAt })),
    ];
  } catch {
    return pages;
  }
}
