import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { PublicHeader, PublicFooter, CtaBand } from "@/components/public/Site";
import { parseBody, readingMinutes } from "@/lib/blog";

export const dynamic = "force-dynamic";

const getPost = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return prisma.blogPost.findFirst({ where: { slug, status: "published" } });
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPost(params.slug);
  return p ? { title: p.title, description: p.excerpt } : { title: "Post not found" };
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const p = await getPost(params.slug);
  if (!p) notFound();
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <nav aria-label="Breadcrumb" className="text-xs font-mono text-muted"><Link href="/blog" className="hover:text-brand">Blog</Link> <span aria-hidden="true">/</span> {p.title}</nav>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-navy mt-4 break-words">{p.title}</h1>
        <p className="text-sm font-mono text-muted mt-3">By {p.authorName} · {p.publishedAt?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {readingMinutes(p.body)} min read</p>
        <p className="text-lg text-secondary font-body mt-6 leading-relaxed">{p.excerpt}</p>
        <div className="mt-8 space-y-4 font-body text-navy leading-relaxed">
          {parseBody(p.body).map((b, i) => b.kind === "h"
            ? <h2 key={i} className="font-display text-xl font-bold mt-8">{b.text}</h2>
            : b.kind === "ul" ? <ul key={i} className="list-disc pl-6 space-y-1">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
            : <p key={i}>{b.text}</p>)}
        </div>
      </article>
      <CtaBand />
      <PublicFooter />
    </main>
  );
}
