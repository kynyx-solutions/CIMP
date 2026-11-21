import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PublicHeader, PublicFooter, PageHero, CtaBand } from "@/components/public/Site";
import { readingMinutes } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog", description: "News, events and founder stories from CIMP-BIIF." };
export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "published" }, orderBy: { publishedAt: "desc" },
    select: { slug: true, title: true, excerpt: true, authorName: true, publishedAt: true, body: true },
  }).catch(() => []);
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow="Blog" title="News and stories" desc="Events, programme updates and founder stories from the CIMP-BIIF team." />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-20">
        {posts.length === 0 ? (
          <p className="bg-white border border-border rounded-2xl p-10 text-center text-muted font-body shadow-card">No posts yet.</p>
        ) : (
          <ul className="space-y-5">
            {posts.map((p) => (
              <li key={p.slug} className="relative bg-white border border-border rounded-2xl p-6 shadow-card hover:shadow-card-md transition-shadow">
                <p className="text-xs font-mono text-muted">{p.publishedAt?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {readingMinutes(p.body)} min read</p>
                <h2 className="font-display text-2xl font-bold text-navy mt-1"><Link href={`/blog/${p.slug}`} className="hover:text-brand after:absolute after:inset-0">{p.title}</Link></h2>
                <p className="text-secondary font-body mt-2">{p.excerpt}</p>
                <p className="text-xs font-body text-muted mt-3">By {p.authorName}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <CtaBand />
      <PublicFooter />
    </main>
  );
}
