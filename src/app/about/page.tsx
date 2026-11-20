import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SectionHeading, SampleTag, Arrow, Check } from "@/components/public/Site";
import { ABOUT, SITE, STATS, IS_SAMPLE } from "@/content/site";

export const metadata: Metadata = {
  title: "About",
  description: `Who we are, our mission and how ${SITE.name} supports early-stage founders.`,
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      <PageHero eyebrow="About" title={`About ${SITE.name}`} desc={SITE.fullName} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-navy">Our mission <SampleTag /></h2>
            <p className="text-secondary font-body mt-2 leading-relaxed">{ABOUT.mission}</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-6 shadow-card">
            <h2 className="font-display text-xl font-semibold text-navy">Our vision <SampleTag /></h2>
            <p className="text-secondary font-body mt-2 leading-relaxed">{ABOUT.vision}</p>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHeading eyebrow="What we offer" title="Four pillars of support" />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ABOUT.pillars.map((p) => (
              <li key={p.title} className="border border-border rounded-2xl p-5 bg-surface-2">
                <h3 className="font-body font-semibold text-navy">{p.title}</h3>
                <p className="text-sm text-secondary font-body mt-2">{p.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-10">
          <div>
            <SectionHeading eyebrow="Institution" title="Who runs CIMP-BIIF" sample={IS_SAMPLE} />
            <ul className="space-y-2.5">
              {[ABOUT.hostedBy, ABOUT.established, ...ABOUT.recognitions].map((r) => (
                <li key={r} className="flex gap-2 text-sm font-body text-secondary"><Check />{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Governance" title="How decisions are made" />
            <p className="text-secondary font-body leading-relaxed">{ABOUT.governance}</p>
            <Link href="/#apply" className="mt-4 inline-flex items-center gap-1 text-brand font-body font-medium text-sm hover:text-navy">
              See the application process <Arrow />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHeading eyebrow="Team" title="Leadership" sample={IS_SAMPLE} />
          <ul className="grid sm:grid-cols-3 gap-5">
            {ABOUT.leadership.map((l, i) => (
              <li key={i} className="border border-border rounded-2xl p-5 bg-surface-2 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-display text-brand text-lg" aria-hidden="true">
                  {l.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-body font-semibold text-navy">{l.name}</h3>
                  <p className="text-xs text-muted font-mono">{l.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.items.map((s) => (
              <div key={s.label} className="bg-white border border-border rounded-2xl p-6 shadow-card text-center flex flex-col">
                <dt className="order-2 text-muted text-xs font-mono uppercase tracking-wider mt-2">{s.label}</dt>
                <dd className="order-1 font-display text-3xl font-bold text-navy">{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-faint font-mono mt-3 text-center">Source: {STATS.source}, as of {STATS.asOf}. <SampleTag /></p>
        </div>
      </section>

      <CtaBand />
      <PublicFooter />
    </main>
  );
}
