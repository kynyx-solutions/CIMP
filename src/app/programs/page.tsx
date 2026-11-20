import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SectionHeading, SampleTag, Check, Arrow } from "@/components/public/Site";
import { PROGRAMS, IS_SAMPLE, ENDEAVOURS } from "@/content/site";

export const metadata: Metadata = {
  title: "Programs",
  description: "Pre-incubation, incubation and acceleration at CIMP-BIIF: who each program is for, what you get, eligibility and terms.",
};

export default function ProgramsPage() {
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow="Programs" title="Programs for every stage of your journey"
        desc="From a first idea to scaling with investors. Every program lists who it is for, what you get and the terms, before you apply.">
        <nav aria-label="Programs on this page" className="flex flex-wrap gap-2">
          {PROGRAMS.map((p) => (
            <a key={p.slug} href={`#${p.slug}`} className="px-4 py-2 rounded-full bg-white border border-border text-navy text-sm font-body hover:border-brand hover:text-brand transition-colors">
              {p.name} <span className="text-saffron-600">· {p.stage}</span>
            </a>
          ))}
        </nav>
      </PageHero>

      {/* Stage path */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10">
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PROGRAMS.map((p, i) => (
            <li key={p.slug} className="bg-white border border-border rounded-2xl p-5 shadow-card-md flex items-center gap-4">
              <span className="w-10 h-10 rounded-full bg-brand text-white font-mono font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">{p.stage}</p>
                <p className="font-body font-semibold text-navy">{p.name} · <span className="text-secondary font-normal">{p.duration}</span></p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Program details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-10">
        {PROGRAMS.map((p) => (
          <section key={p.slug} id={p.slug} aria-labelledby={`${p.slug}-title`} className="scroll-mt-24 bg-white border border-border rounded-3xl shadow-card overflow-hidden">
            <div className="grid lg:grid-cols-[1.1fr_1fr]">
              <div className="p-6 sm:p-10">
                <p className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">{p.stage}</p>
                <h2 id={`${p.slug}-title`} className="font-display text-3xl font-bold text-navy mt-1">
                  {p.name} {IS_SAMPLE && <SampleTag />}
                </h2>
                <p className="text-secondary font-body mt-3 leading-relaxed">{p.forWho}</p>
                <h3 className="font-body font-semibold text-navy mt-6 mb-3">What you get</h3>
                <ul className="space-y-2.5">
                  {p.includes.map((b) => <li key={b} className="flex gap-2 text-sm font-body text-navy"><Check />{b}</li>)}
                </ul>
                <p className="mt-6 text-sm font-body text-secondary bg-leaf-50 border border-leaf-100 rounded-xl px-4 py-3">
                  <strong className="text-navy">Outcome:</strong> {p.outcome}
                </p>
              </div>
              <aside className="bg-surface-2 border-t lg:border-t-0 lg:border-l border-border p-6 sm:p-10 flex flex-col">
                <dl className="grid grid-cols-2 gap-4">
                  <div><dt className="text-xs font-mono uppercase tracking-wider text-muted">Duration</dt><dd className="font-body font-semibold text-navy mt-1">{p.duration}</dd></div>
                  <div><dt className="text-xs font-mono uppercase tracking-wider text-muted">Format</dt><dd className="font-body font-semibold text-navy mt-1">{p.format}</dd></div>
                  <div className="col-span-2"><dt className="text-xs font-mono uppercase tracking-wider text-muted">Terms</dt><dd className="font-body font-semibold text-navy mt-1">{p.terms}</dd></div>
                </dl>
                <h3 className="font-body font-semibold text-navy mt-6 mb-3">Eligibility</h3>
                <ul className="space-y-2 flex-1">
                  {p.eligibility.map((e) => <li key={e} className="flex gap-2 text-sm font-body text-secondary"><Check />{e}</li>)}
                </ul>
                <Link href="/register" className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-semibold font-body hover:opacity-90">
                  Apply for {p.name} <Arrow />
                </Link>
              </aside>
            </div>
          </section>
        ))}

        {/* Comparison */}
        <section aria-labelledby="compare-title">
          <SectionHeading eyebrow="Compare" title="Programs at a glance" sample={IS_SAMPLE} />
          <div className="overflow-x-auto bg-white border border-border rounded-2xl shadow-card">
            <table className="w-full text-sm font-body min-w-[640px]">
              <caption id="compare-title" className="sr-only">Program comparison</caption>
              <thead>
                <tr className="bg-surface-2 text-left">
                  <th scope="col" className="p-4 font-semibold text-muted text-xs font-mono uppercase tracking-wider"> </th>
                  {PROGRAMS.map((p) => <th key={p.slug} scope="col" className="p-4 font-semibold text-navy">{p.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {([["Stage", "stage"], ["Duration", "duration"], ["Format", "format"], ["Terms", "terms"]] as const).map(([label, key]) => (
                  <tr key={key}>
                    <th scope="row" className="p-4 text-left text-xs font-mono uppercase tracking-wider text-muted font-semibold">{label}</th>
                    {PROGRAMS.map((p) => <td key={p.slug} className="p-4 text-secondary">{p[key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted font-body mt-4">
            Not sure which fits? Check the <Link href="/how-to-apply" className="text-brand underline">application process</Link> or the <Link href="/faq" className="text-brand underline">FAQ</Link>.
          </p>
        </section>
        {/* Other initiatives listed on cimpbiif.com as "Our Entrepreneurial Endeavours" */}
        <section aria-labelledby="endeavours-title">
          <SectionHeading eyebrow="Beyond incubation" title="Our entrepreneurial endeavours" desc="Learning programmes and initiatives run by CIMP and CIMP-BIIF." />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ENDEAVOURS.map((e) => (
              <li key={e.name} className="bg-white border border-border rounded-2xl p-6 shadow-card">
                <h3 className="font-body font-bold text-navy">{e.name}</h3>
                <p className="text-sm text-secondary font-body mt-2 leading-relaxed">{e.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <CtaBand />
      <PublicFooter />
    </main>
  );
}
