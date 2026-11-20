import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SampleTag } from "@/components/public/Site";
import { MENTORS, IS_SAMPLE } from "@/content/site";

export const metadata: Metadata = {
  title: "Mentors & Investors",
  description: "The CIMP-BIIF network of mentors and investors, by expertise and sector.",
};

const TYPES = ["Mentor", "Investor"] as const;
const SECTORS = Array.from(new Set(MENTORS.flatMap((m) => m.sectors))).filter((s) => s !== "All sectors").sort();

export default function MentorsPage({ searchParams }: { searchParams: { type?: string; sector?: string } }) {
  const type = searchParams.type ?? "";
  const sector = searchParams.sector ?? "";
  const list = MENTORS.filter((m) =>
    (!type || m.type.includes(type)) &&
    (!sector || m.sectors.includes(sector) || m.sectors.includes("All sectors")),
  );
  const filtering = Boolean(type || sector);
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-body border transition-colors ${active ? "bg-brand text-white border-brand" : "bg-white text-secondary border-border hover:border-brand hover:text-brand"}`;
  // Filter links keep the other filter (plain links: works without JavaScript, shareable URLs)
  const href = (next: { type?: string; sector?: string }) => {
    const p = new URLSearchParams();
    const t = next.type ?? type;
    const s = next.sector ?? sector;
    if (t) p.set("type", t);
    if (s) p.set("sector", s);
    const q = p.toString();
    return q ? `/mentors?${q}` : "/mentors";
  };

  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow="Network" title="Mentors and investors"
        desc="Experienced founders, domain experts and investors who guide CIMP-BIIF startups. Incubatees are matched through a reviewed connection process." />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-20">
        <div className="bg-white border border-border rounded-2xl shadow-card-md p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted w-16">Type</span>
            <Link href={href({ type: "" })} className={chip(!type)}>All</Link>
            {TYPES.map((t) => <Link key={t} href={href({ type: t })} className={chip(type === t)}>{t}s</Link>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted w-16">Sector</span>
            <Link href={href({ sector: "" })} className={chip(!sector)}>All</Link>
            {SECTORS.map((s) => <Link key={s} href={href({ sector: s })} className={chip(sector === s)}>{s}</Link>)}
          </div>
        </div>

        <p className="text-muted text-sm font-mono my-6" aria-live="polite">
          {filtering ? `${list.length} of ${MENTORS.length}` : MENTORS.length} people {IS_SAMPLE && <SampleTag />}
        </p>

        {list.length === 0 ? (
          <div className="text-center py-16 bg-white border border-border rounded-2xl shadow-card">
            <p className="font-body text-secondary">No one matches these filters yet. <Link href="/mentors" className="text-brand underline">Clear filters</Link></p>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {list.map((m, i) => (
              <li key={i} className="bg-white border border-border rounded-2xl p-5 shadow-card flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-full bg-leaf-50 border border-leaf-100 flex items-center justify-center font-display text-brand text-lg" aria-hidden="true">{m.name.charAt(0)}</div>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${m.type === "Mentor" ? "text-brand bg-leaf-50 border-leaf-100" : "text-violet-700 bg-violet-50 border-violet-200"}`}>{m.type}</span>
                </div>
                <h2 className="font-body font-semibold text-navy mt-3">{m.name}</h2>
                <p className="text-xs text-muted font-mono">{m.role}</p>
                <p className="text-sm text-secondary font-body mt-2 flex-1">{m.expertise}</p>
                <ul className="flex flex-wrap gap-1.5 mt-3">
                  {m.sectors.map((s) => <li key={s} className="text-[11px] font-mono text-secondary bg-bg border border-border px-2 py-0.5 rounded-full">{s}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
            <h2 className="font-display text-2xl font-bold text-navy">For incubatees</h2>
            <p className="text-secondary font-body mt-2">Once you are incubated, request a mentor or investor connection from your dashboard. The incubation team reviews each request and the mentor accepts it before you are connected.</p>
            <Link href="/how-to-apply" className="mt-4 inline-block text-brand font-body font-semibold text-sm">How to apply →</Link>
          </div>
          <div className="rounded-2xl p-6 sm:p-8 bg-navy text-white">
            <h2 className="font-display text-2xl font-bold">Become a mentor or investor</h2>
            <p className="text-leaf-100 font-body mt-2">Share your experience with early-stage founders. Mentor and investor profiles are reviewed and approved by the office before they are listed here.</p>
            <Link href="/#contact" className="mt-4 inline-flex px-5 py-2.5 rounded-lg bg-white text-navy font-semibold text-sm font-body hover:bg-leaf-50">Get in touch</Link>
          </div>
        </section>
      </div>

      <CtaBand />
      <PublicFooter />
    </main>
  );
}
