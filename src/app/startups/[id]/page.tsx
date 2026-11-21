// Public startup profile (PRD PUB-1, WEB-13). Only approved, published startups, and only
// fields that are safe to show publicly (Admin IT will control this list: PRD FORM-3).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isId } from "@/lib/serialize";
import { PublicHeader, PublicFooter, CtaBand } from "@/components/public/Site";
import { publicFields, valueOf, displayValue } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";

export const dynamic = "force-dynamic";

const getStartup = cache(async (id: string) => {
  if (!isId(id)) return null;
  // The full row stays on the server; only fields Admin IT made public are rendered (PRD FORM-3).
  return prisma.application.findFirst({
    where: { id, isPublic: true, status: "approved" },
    include: { documents: { where: { kind: "logo" }, select: { id: true } } },
  });
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const s = await getStartup(params.id);
  if (!s) return { title: "Startup not found" };
  return { title: s.startupName, description: `${s.startupName}: ${s.idea}` };
}

export default async function StartupProfile({ params }: { params: { id: string } }) {
  const s = await getStartup(params.id);
  if (!s) notFound();
  const logo = s.documents[0]?.id;
  const form = await getForm("application");
  const pub = new Map(publicFields(form).map((f) => [f.key, f]));
  const show = (key: string) => (pub.has(key) ? displayValue(valueOf(s, pub.get(key)!)) : "");
  const place = [show("city"), show("state")].filter(Boolean).join(", ");
  const website = show("website");
  // Shown in fixed places above; everything else public is listed generically
  const placed = new Set(["startupName", "industry", "idea", "city", "state", "website"]);
  const rest = publicFields(form).filter((f) => !placed.has(f.key)).map((f) => ({ f, v: displayValue(valueOf(s, f)) })).filter((x) => x.v);
  const long = rest.filter((x) => x.f.type === "textarea");
  const facts = [
    { k: "Sector", v: s.industry },
    ...rest.filter((x) => x.f.type !== "textarea").map((x) => ({ k: x.f.label, v: x.v })),
    { k: "Location", v: place || null },
    { k: "Incubated since", v: new Date(s.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) },
  ].filter((f) => f.v);

  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      <section className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-xs font-mono text-muted mb-6">
            <Link href="/startups" className="hover:text-brand">Startup directory</Link> <span aria-hidden="true">/</span> {s.startupName}
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/documents/${logo}`} alt={`${s.startupName} logo`} className="w-24 h-24 rounded-2xl object-contain bg-white border border-border p-2 flex-shrink-0" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-leaf-50 border border-leaf-200 flex items-center justify-center font-display text-4xl font-bold text-brand flex-shrink-0" aria-hidden="true">
                {s.startupName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-xs font-mono text-brand bg-leaf-50 border border-leaf-100 px-2 py-0.5 rounded-full">{s.industry}</span>
                <span className="text-xs font-mono text-leaf-800 bg-leaf-50 border border-leaf-200 px-2 py-0.5 rounded-full">CIMP-BIIF incubatee</span>
                {s.isFastTracked && <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Fast-tracked</span>}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-navy break-words">{s.startupName}</h1>
              {place && <p className="text-muted text-sm font-body mt-1">📍 {place}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-[1fr_280px] gap-6 items-start">
        <article className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
          <h2 className="text-xs font-mono text-muted uppercase tracking-wider">What they do</h2>
          <p className="font-body text-lg text-navy leading-relaxed mt-3">{s.idea}</p>
          {long.map(({ f, v }) => (
            <section key={f.key} className="mt-8">
              <h2 className="text-xs font-mono text-muted uppercase tracking-wider">{f.label}</h2>
              <p className="font-body text-secondary leading-relaxed mt-3 whitespace-pre-line">{v}</p>
            </section>
          ))}
          {/^https?:\/\//.test(website) && (
            <a href={website} target="_blank" rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body hover:opacity-90">
              Visit website ↗
            </a>
          )}
        </article>
        <aside className="bg-white border border-border rounded-2xl p-6 shadow-card">
          <dl className="space-y-4">
            {facts.map((f) => (
              <div key={f.k}>
                <dt className="text-[11px] font-mono text-muted uppercase tracking-wider">{f.k}</dt>
                <dd className="font-body text-navy font-semibold mt-0.5 break-words">{f.v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <CtaBand />
      <PublicFooter />
    </main>
  );
}
