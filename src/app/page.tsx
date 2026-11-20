import Link from "next/link";
import { PublicHeader, PublicFooter, SectionHeading, SampleTag, Arrow, Check } from "@/components/public/Site";
import HeroVisual from "@/components/public/HeroVisual";
import HeroBackground from "@/components/public/HeroBackground";
import { prisma } from "@/lib/prisma";
import {
  IS_SAMPLE, SITE, STATS, OPEN_CALLS, PROGRAMS, APPLY_STEPS, ELIGIBILITY,
  RESPONSE_TIME, SCHEMES, MENTORS, PARTNERS,
} from "@/content/site";

// Server-rendered on every request: numbers are in the HTML (no "0+" counters)
// and the featured startups reflect the live public directory.
export const dynamic = "force-dynamic";

type Featured = { _id: string; startupName: string; industry: string; idea: string; isFastTracked: boolean };

async function loadFeatured(): Promise<Featured[]> {
  const rows = await prisma.application.findMany({
    where: { isPublic: true, status: "approved" },
    select: { id: true, startupName: true, industry: true, idea: true, isFastTracked: true },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });
  return rows.map((r) => ({ ...r, _id: r.id }));
}

// The homepage must render even if the database is slow or down:
// give up on featured startups after 3 s instead of hanging on a slow connection.
async function getFeaturedStartups(): Promise<Featured[]> {
  const timeout = new Promise<Featured[]>((resolve) => setTimeout(() => resolve([]), 3000));
  return Promise.race([loadFeatured().catch(() => []), timeout]);
}


export default async function HomePage() {
  const featured = await getFeaturedStartups();

  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      {/* ═══ HERO (dark "Launchpad") ═══ */}
      <section className="relative overflow-hidden bg-[#081127]">
        <HeroBackground />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-28 md:pt-24 md:pb-36 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-cyan-200 text-xs font-mono tracking-[0.15em] uppercase font-semibold mb-8 backdrop-blur">
              <span className="relative flex w-2 h-2" aria-hidden="true">
                <span className="hero-ping absolute inline-flex w-full h-full rounded-full bg-cyan-300" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-cyan-300" />
              </span>
              Applications open
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-white leading-[1.08] max-w-3xl mx-auto lg:mx-0 mb-6 drop-shadow-[0_2px_24px_rgba(59,130,246,0.35)]">
              Launch your startup with <span className="hero-gradient-text">CIMP-BIIF</span>
            </h1>
            <p className="text-blue-100/90 font-body text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
              {SITE.tagline} {SITE.intro}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link href="/register" className="group w-full sm:w-auto px-7 py-3.5 rounded-xl text-navy font-semibold font-body bg-gradient-to-r from-cyan-300 to-blue-300 hover:from-cyan-200 hover:to-blue-200 transition-colors inline-flex items-center justify-center gap-2 shadow-[0_0_32px_rgba(103,232,249,0.45)]">
                Apply for Incubation <span className="group-hover:translate-x-0.5 transition-transform"><Arrow /></span>
              </Link>
              <Link href="#programs" className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-white/25 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 font-body transition-colors backdrop-blur">
                Find the right program
              </Link>
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* ═══ OPEN CALLS ═══ */}
      <section aria-labelledby="calls-heading" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 -mt-14 mb-16">
        <div className="bg-white border border-border rounded-2xl shadow-card p-4 sm:p-5">
          <h2 id="calls-heading" className="text-xs font-mono uppercase tracking-[0.15em] text-muted font-semibold mb-3 px-1">
            Open calls <SampleTag />
          </h2>
          <ul className="grid sm:grid-cols-3 gap-3">
            {OPEN_CALLS.map((c) => (
              <li key={c.title}>
                <Link href={c.href} className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 hover:border-brand transition-colors h-full">
                  <span>
                    <span className="block font-body font-semibold text-navy text-sm">{c.title}</span>
                    <span className="block font-mono text-xs text-muted mt-0.5">Deadline: {c.deadline}</span>
                  </span>
                  <span className="text-brand group-hover:translate-x-0.5 transition-transform"><Arrow /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ IMPACT STATS ═══ */}
      <section aria-labelledby="impact-heading" className="max-w-7xl mx-auto px-4 sm:px-6 mb-20">
        <h2 id="impact-heading" className="sr-only">Impact</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.items.map((s) => (
            <div key={s.label} className="bg-white border border-border rounded-2xl p-6 shadow-card text-center flex flex-col">
              <dt className="order-2 text-muted text-xs font-mono uppercase tracking-wider mt-2">{s.label}</dt>
              <dd className="order-1 font-display text-3xl md:text-4xl font-bold text-navy">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-faint font-mono mt-3 text-center">
          Source: {STATS.source}, as of {STATS.asOf}. <SampleTag />
        </p>
      </section>

      {/* ═══ PROGRAMS BY STAGE ═══ */}
      <section id="programs" className="border-t border-border bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading eyebrow="Programs" title="Pick the program that fits your stage" desc="Every program lists who it is for, what you get and the terms, before you apply." sample={IS_SAMPLE} />
          <div className="grid md:grid-cols-3 gap-6">
            {PROGRAMS.map((p) => (
              <article key={p.name} className="flex flex-col border border-border rounded-2xl p-6 bg-surface-2 hover:shadow-card-md transition-shadow">
                <p className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">{p.stage}</p>
                <h3 className="font-display text-2xl font-semibold text-navy mt-1">{p.name}</h3>
                <p className="text-xs font-mono text-muted mt-1">{p.duration}</p>
                <p className="text-sm text-secondary font-body mt-4">{p.forWho}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {p.benefits.map((b) => (
                    <li key={b} className="flex gap-2 text-sm font-body text-navy"><Check />{b}</li>
                  ))}
                </ul>
                <p className="mt-5 pt-4 border-t border-border text-xs font-body text-secondary">
                  <span className="font-semibold text-navy">Terms:</span> {p.terms}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW TO APPLY ═══ */}
      <section id="apply" className="border-t border-border scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-[1.4fr_1fr] gap-12">
          <div>
            <SectionHeading eyebrow="How to apply" title="A clear process you can track live" desc="No email chains or external forms. You apply in the portal and see each review stage, remark and decision as it happens." />
            <ol className="relative border-l-2 border-blue-100 ml-3 space-y-8">
              {APPLY_STEPS.map((s, i) => (
                <li key={s.title} className="pl-8 relative">
                  <span className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-brand text-white font-mono text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <h3 className="font-body font-semibold text-navy">{s.title}</h3>
                  <p className="text-sm text-secondary font-body mt-1">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
          <aside className="space-y-6">
            <div className="bg-white border border-border rounded-2xl p-6 shadow-card">
              <h3 className="font-body font-semibold text-navy mb-4">Who can apply <SampleTag /></h3>
              <ul className="space-y-2.5">
                {ELIGIBILITY.map((e) => (
                  <li key={e} className="flex gap-2 text-sm font-body text-secondary"><Check />{e}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-6 bg-navy text-white">
              <p className="text-xs font-mono uppercase tracking-wider text-blue-200">Always know where you stand</p>
              <p className="font-body mt-2 text-sm leading-relaxed text-blue-50">{RESPONSE_TIME}, with email and in-app notifications.</p>
              <Link href="/register" className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-navy font-semibold text-sm font-body hover:bg-blue-50 transition-colors">
                Start your application <Arrow />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ═══ FEATURED STARTUPS (live) ═══ */}
      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <SectionHeading eyebrow="Portfolio" title="Startups building with us" desc="Live from the public directory. Startups appear here once approved and published." />
            <Link href="/public-startups" className="text-brand font-body font-medium text-sm inline-flex items-center gap-1 hover:text-navy whitespace-nowrap mb-10">
              View full directory <Arrow />
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-10 text-center text-muted font-body text-sm">
              No startups published yet. Approved startups appear here after the CEO or Admin IT publishes them.
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map((s) => (
                <li key={s._id} className="border border-border rounded-2xl p-5 bg-surface-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-body font-semibold text-navy">{s.startupName}</h3>
                    <span className="text-[11px] font-mono text-brand bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">{s.industry}</span>
                    {s.isFastTracked && <span className="text-[11px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Fast-tracked</span>}
                  </div>
                  <p className="text-sm text-secondary font-body mt-2 line-clamp-3">{s.idea}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ═══ MENTORS & INVESTORS ═══ */}
      <section id="mentors" className="border-t border-border scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading eyebrow="Network" title="Mentors and investors" desc="Incubatees are matched with mentors and investors through a reviewed connection process." sample={IS_SAMPLE} />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {MENTORS.map((m, i) => (
              <li key={i} className="bg-white border border-border rounded-2xl p-5 shadow-card">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-display text-brand text-lg" aria-hidden="true">
                  {m.name.charAt(0)}
                </div>
                <h3 className="font-body font-semibold text-navy mt-3">{m.name}</h3>
                <p className="text-xs text-muted font-mono">{m.role}</p>
                <p className="text-sm text-secondary font-body mt-2">{m.expertise}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white border border-border rounded-2xl p-5">
            <p className="font-body text-sm text-secondary flex-1">
              <span className="font-semibold text-navy">Experienced founder, expert or investor?</span> Join the CIMP-BIIF mentor and investor network.
            </p>
            <Link href="#contact" className="px-5 py-2.5 rounded-lg border border-brand text-brand font-semibold text-sm font-body hover:bg-blue-50 transition-colors">
              Become a mentor
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ GOVERNMENT SCHEMES ═══ */}
      <section id="schemes" className="border-t border-border bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <SectionHeading eyebrow="Funding" title="Government schemes we can help you access" desc="Grouped by ministry. Indicative list; CIMP to confirm which schemes it operates." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SCHEMES.map((g) => (
              <div key={g.ministry} className="border border-border rounded-2xl p-5 bg-surface-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted font-semibold">{g.ministry}</p>
                <ul className="mt-3 space-y-2">
                  {g.items.map((it) => (
                    <li key={it} className="flex gap-2 text-sm font-body text-navy"><Check />{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PARTNERS ═══ */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-center text-xs font-mono uppercase tracking-[0.15em] text-muted font-semibold mb-6">
            Supported by <SampleTag />
          </h2>
          <ul className="flex flex-wrap justify-center gap-3">
            {PARTNERS.map((p) => (
              <li key={p} className="px-4 py-2 rounded-lg border border-border bg-white text-sm font-body text-secondary">{p}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="bg-navy">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-white">Ready to build with CIMP-BIIF?</h2>
          <p className="text-blue-100 font-body mt-3">Apply in minutes and track every step of your review online.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="px-7 py-3.5 rounded-xl bg-white text-navy font-semibold font-body hover:bg-blue-50 transition-colors inline-flex items-center justify-center gap-2">
              Apply for Incubation <Arrow />
            </Link>
            <Link href="/login" className="px-7 py-3.5 rounded-xl border border-blue-300/40 text-white font-body hover:bg-white/10 transition-colors">
              Login to your dashboard
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
