import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PublicHeader, PublicFooter, PageHero } from "@/components/public/Site";
import { INDUSTRIES } from "@/lib/application-fields";
import { getForm } from "@/lib/forms-server";
import { publicFields } from "@/lib/forms";

export const metadata: Metadata = {
  title: "Startup Directory",
  description: "Search and filter startups incubated at CIMP-BIIF by sector, stage and location.",
};

// Always render on request: directory must reflect publish/unpublish immediately
// and the build must not need a database connection.
export const dynamic = "force-dynamic";

type Search = { q?: string; industry?: string; stage?: string };

// Only the fields Admin IT made public reach the page (PRD PUB-1, FORM-3).
async function getPublicStartups() {
  const form = await getForm("application");
  const pub = new Set(publicFields(form).map((f) => f.key));
  const stageField = form.fields.find((f) => f.key === "ventureStage");
  const rows = await prisma.application.findMany({
    where: { isPublic: true, status: "approved" },
    select: {
      id: true, startupName: true, idea: true, industry: true, ventureStage: true,
      city: true, state: true, website: true, isFastTracked: true, createdAt: true,
      documents: { where: { kind: "logo" }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const keep = <T,>(key: string, v: T) => (pub.has(key) ? v : null);
  return {
    stageOptions: pub.has("ventureStage") ? stageField?.options ?? [] : [],
    startups: rows.map((r) => ({
      ...r, ventureStage: keep("ventureStage", r.ventureStage), city: keep("city", r.city),
      state: keep("state", r.state), website: keep("website", r.website),
    })),
  };
}

export default async function PublicStartupsPage({ searchParams }: { searchParams: Search }) {
  const { startups: all, stageOptions: STAGE_OPTIONS } = await getPublicStartups();
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const industry = searchParams.industry ?? "";
  const stage = searchParams.stage ?? "";

  // Filtered in memory: the published list is small and this works the same on any database.
  const startups = all.filter((s) =>
    (!q || [s.startupName, s.idea, s.city, s.state].some((v) => v?.toLowerCase().includes(q))) &&
    (!industry || s.industry === industry) &&
    (!stage || s.ventureStage === stage),
  );
  const filtering = Boolean(q || industry || stage);

  const selectCls = "bg-white border border-border rounded-xl px-3 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2";

  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      <PageHero eyebrow="Portfolio" title="Startup directory"
        desc="Startups approved through CIMP-BIIF's four-stage review and published to the directory." />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-20">

        {/* Filters: a plain GET form, so it works without JavaScript and results are shareable by URL */}
        <form method="get" className="bg-white border border-border rounded-2xl p-4 shadow-card mb-8 grid gap-3 md:grid-cols-[1fr_auto_auto_auto] items-end" role="search">
          <label className="block">
            <span className="block text-xs font-mono text-muted uppercase tracking-wider mb-1">Search</span>
            <input type="search" name="q" defaultValue={searchParams.q ?? ""} placeholder="Name, idea or city"
              className={`${selectCls} w-full placeholder:text-faint`} />
          </label>
          <label className="block">
            <span className="block text-xs font-mono text-muted uppercase tracking-wider mb-1">Sector</span>
            <select name="industry" defaultValue={industry} className={selectCls}>
              <option value="">All sectors</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          {STAGE_OPTIONS.length > 0 ? (
            <label className="block">
              <span className="block text-xs font-mono text-muted uppercase tracking-wider mb-1">Stage</span>
              <select name="stage" defaultValue={stage} className={selectCls}>
                <option value="">All stages</option>
                {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          ) : <span aria-hidden="true" />}
          <div className="flex gap-2">
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body hover:opacity-90">Filter</button>
            {filtering && <Link href="/startups" className="px-4 py-2.5 rounded-xl border border-border text-sm font-body text-secondary hover:text-navy">Clear</Link>}
          </div>
        </form>

        <p className="text-muted text-sm font-mono mb-6" aria-live="polite">
          {filtering ? `${startups.length} of ${all.length}` : all.length} startup{all.length !== 1 ? "s" : ""}
        </p>

        {startups.length === 0 ? (
          <div className="text-center py-20 bg-white border border-border rounded-2xl shadow-card">
            <h2 className="font-display text-2xl font-bold text-navy mb-2">
              {filtering ? "No startups match these filters" : "No startups published yet"}
            </h2>
            <p className="text-muted font-body">
              {filtering ? "Try a different search or clear the filters." : "Approved startups appear here once they are published."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {startups.map((s) => (
              <li key={s.id} className={`relative bg-white border rounded-2xl p-6 flex flex-col shadow-card hover:shadow-card-md transition-shadow ${s.isFastTracked ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs font-mono text-brand bg-leaf-50 border border-leaf-100 px-2 py-0.5 rounded-full">{s.industry}</span>
                  {s.ventureStage && <span className="text-xs font-mono text-secondary bg-bg border border-border px-2 py-0.5 rounded-full">{s.ventureStage}</span>}
                  {s.isFastTracked && <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Fast-tracked</span>}
                </div>
                <div className="flex items-center gap-3 mb-1">
                  {s.documents[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/documents/${s.documents[0].id}`} alt="" className="w-11 h-11 rounded-xl object-contain bg-white border border-border p-1 flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-leaf-50 border border-leaf-200 flex items-center justify-center font-display font-bold text-brand flex-shrink-0" aria-hidden="true">{s.startupName.charAt(0)}</div>
                  )}
                  <h2 className="font-display text-2xl font-bold text-navy min-w-0 break-words">
                    <Link href={`/startups/${s.id}`} className="hover:text-brand after:absolute after:inset-0">{s.startupName}</Link>
                  </h2>
                </div>
                {(s.city || s.state) && <p className="text-muted text-xs font-body mb-3">📍 {[s.city, s.state].filter(Boolean).join(", ")}</p>}
                <p className="text-secondary text-sm font-body leading-relaxed flex-1 line-clamp-4">{s.idea}</p>
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3">
                  <p className="text-faint text-xs font-mono">
                    Incubated {new Date(s.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}
                  </p>
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer" className="relative z-10 text-xs font-body font-medium text-brand hover:text-navy">
                      Website ↗<span className="sr-only"> for {s.startupName}</span>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PublicFooter />
    </main>
  );
}
