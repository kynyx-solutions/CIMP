import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SectionHeading, SampleTag, Arrow, Check } from "@/components/public/Site";
import { ABOUT, SITE, STATS, LEADERSHIP_MESSAGES, HOST_INSTITUTE, POLICIES, SDGS } from "@/content/site";

export const metadata: Metadata = {
  title: "About",
  description: "CIMP Business Incubation and Innovation Foundation (CIMP-BIIF), the incubator of Chandragupt Institute of Management Patna: story, mission, leadership and recognitions.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      <PageHero eyebrow="About" title={SITE.fullName}
        desc={`The startup incubator of ${SITE.hostInstitute}, building Bihar's entrepreneurial ecosystem since 2017.`} />

      {/* Vision & mission */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-border rounded-2xl p-6 shadow-card-md">
            <h2 className="font-display text-xl font-bold text-navy">Our vision</h2>
            <p className="text-secondary font-body mt-2 leading-relaxed">{ABOUT.vision}</p>
          </div>
          <div className="bg-white border border-border rounded-2xl p-6 shadow-card-md">
            <h2 className="font-display text-xl font-bold text-navy">Our mission</h2>
            <p className="text-secondary font-body mt-2 leading-relaxed">{ABOUT.mission}</p>
          </div>
        </div>
      </section>

      {/* Story + recognitions */}
      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-12">
          <div>
            <SectionHeading eyebrow="Our story" title="From incubation centre to foundation" />
            <ol className="relative border-l-2 border-leaf-100 ml-2 space-y-6">
              {ABOUT.story.map((s, i) => (
                <li key={i} className="pl-6 relative">
                  <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-brand border-4 border-leaf-100" aria-hidden="true" />
                  <p className="font-body text-secondary leading-relaxed">{s}</p>
                </li>
              ))}
            </ol>
            <p className="text-sm font-body text-muted mt-6">{ABOUT.hostedBy}.</p>
          </div>
          <div>
            <SectionHeading eyebrow="Recognition" title="Backing and recognition" />
            <ul className="space-y-3">
              {ABOUT.recognitions.map((r) => <li key={r} className="flex gap-2 font-body text-secondary"><Check />{r}</li>)}
            </ul>
            <h3 className="font-body font-semibold text-navy mt-8 mb-3">Partners</h3>
            <ul className="flex flex-wrap gap-2">
              {ABOUT.partners.map((p) => <li key={p} className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-sm font-body text-secondary">{p}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHeading eyebrow="What we offer" title="Four pillars of support" />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ABOUT.pillars.map((p) => (
              <li key={p.title} className="bg-white border border-border rounded-2xl p-5 shadow-card">
                <h3 className="font-body font-semibold text-navy">{p.title}</h3>
                <p className="text-sm text-secondary font-body mt-2">{p.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Services + sectors */}
      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-[1.3fr_1fr] gap-12">
          <div>
            <SectionHeading eyebrow="Services" title="How we support startups" />
            <ul className="grid sm:grid-cols-2 gap-3">
              {ABOUT.services.map((s) => <li key={s} className="flex gap-2 font-body text-secondary"><Check />{s}</li>)}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Focus" title="Thrust sectors" />
            <ul className="flex flex-wrap gap-2">
              {ABOUT.sectors.map((s) => <li key={s} className="px-3 py-1.5 rounded-full bg-leaf-50 border border-leaf-100 text-brand text-sm font-body">{s}</li>)}
            </ul>
            <p className="text-sm text-muted font-body mt-4">Applications from other sectors are welcome too.</p>
          </div>
        </div>
      </section>

      {/* Messages from the leadership (from cimpbiif.com, 2025) */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHeading eyebrow="Leadership" title="Messages from our leadership" />
          <div className="grid lg:grid-cols-2 gap-6">
            {LEADERSHIP_MESSAGES.map((m) => (
              <figure key={m.name} className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card flex flex-col">
                <span className="font-display text-6xl leading-none text-leaf-300" aria-hidden="true">&ldquo;</span>
                <blockquote className="text-secondary font-body leading-relaxed -mt-4 flex-1">{m.message}</blockquote>
                <figcaption className="mt-6 flex items-center gap-4 pt-5 border-t border-border">
                  <div className="w-12 h-12 rounded-full bg-leaf-50 border border-leaf-200 flex items-center justify-center font-display font-bold text-brand text-lg flex-shrink-0" aria-hidden="true">
                    {m.name.replace(/^Prof\. \(Dr\.\) /, "").charAt(0)}
                  </div>
                  <div>
                    <p className="font-body font-bold text-navy">{m.name}</p>
                    <p className="text-xs text-muted font-mono">{m.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-10 max-w-3xl">
            <h3 className="font-body font-bold text-navy mb-2">How decisions are made</h3>
            <p className="text-secondary font-body leading-relaxed">{ABOUT.governance}</p>
            <Link href="/how-to-apply" className="mt-3 inline-flex items-center gap-1 text-brand font-body font-medium text-sm hover:text-navy">
              See the application process <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* Host institute + policies */}
      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-12">
          <div>
            <SectionHeading eyebrow="Host institute" title={HOST_INSTITUTE.name} />
            <ul className="space-y-3">
              {HOST_INSTITUTE.points.map((p) => <li key={p} className="flex gap-2 font-body text-secondary"><Check />{p}</li>)}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Policies" title="Our policy framework" />
            <div className="space-y-4">
              {POLICIES.map((p) => (
                <article key={p.name} className="border border-border rounded-2xl p-5 bg-surface-2">
                  <h3 className="font-body font-bold text-navy">{p.name}</h3>
                  <p className="text-sm text-secondary font-body mt-2 leading-relaxed">{p.desc}</p>
                  {p.vision && <p className="text-sm font-body mt-3"><strong className="text-navy">Vision:</strong> <span className="text-secondary">{p.vision}</span></p>}
                  {p.mission && <p className="text-sm font-body mt-1"><strong className="text-navy">Mission:</strong> <span className="text-secondary">{p.mission}</span></p>}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key focus areas: UN SDGs */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <SectionHeading eyebrow="Key focus areas" title="Aligned with the UN Sustainable Development Goals"
            desc="We encourage startups that solve real problems for people and the planet, across all 17 goals." />
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SDGS.map((g, i) => (
              <li key={g} className="bg-white border border-border rounded-xl p-3 shadow-card flex items-start gap-2">
                <span className="w-7 h-7 rounded-lg bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-sm font-body text-navy leading-snug">{g}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Stats (still sample) */}
      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.items.map((s) => (
              <div key={s.label} className="bg-bg border border-border rounded-2xl p-6 text-center flex flex-col">
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
