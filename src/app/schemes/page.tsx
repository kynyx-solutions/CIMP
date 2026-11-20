import type { Metadata } from "next";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SectionHeading } from "@/components/public/Site";
import { SCHEME_DETAILS, SCHEMES } from "@/content/site";

export const metadata: Metadata = {
  title: "Government Schemes",
  description: "Government funding schemes CIMP-BIIF can help startups access: SISFS, NIDHI-PRAYAS, NIDHI-EIR, GENESIS and BIRAC BIG.",
};

export default function SchemesPage() {
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow="Funding" title="Government schemes we help you access"
        desc="Grants, fellowships and seed funds from central ministries. We help you check eligibility, prepare the application and connect with the right program.">
        <nav aria-label="Ministries on this page" className="flex flex-wrap gap-2">
          {SCHEMES.map((g) => (
            <a key={g.ministry} href={`#${slug(g.ministry)}`} className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-body hover:bg-white/20 backdrop-blur">
              {g.ministry}
            </a>
          ))}
        </nav>
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <p role="note" className="mb-10 text-sm font-body text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          Indicative summary. Amounts, eligibility and deadlines are set by each scheme&apos;s official guidelines and change over time; always check the official site. CIMP will confirm which schemes it operates.
        </p>

        <div className="space-y-12">
          {SCHEMES.map((g) => (
            <section key={g.ministry} id={slug(g.ministry)} className="scroll-mt-24" aria-labelledby={`${slug(g.ministry)}-h`}>
              <h2 id={`${slug(g.ministry)}-h`} className="font-display text-2xl font-semibold text-navy mb-5">{g.ministry}</h2>
              <div className="grid md:grid-cols-2 gap-5">
                {SCHEME_DETAILS.filter((s) => s.ministry === g.ministry).map((s) => (
                  <article key={s.name} className="bg-white border border-border rounded-2xl p-6 shadow-card flex flex-col">
                    <h3 className="font-body font-semibold text-lg text-navy">{s.name}</h3>
                    <dl className="mt-4 space-y-3 text-sm font-body flex-1">
                      <div><dt className="text-xs font-mono uppercase tracking-wider text-muted">Support</dt><dd className="text-secondary mt-0.5">{s.support}</dd></div>
                      <div><dt className="text-xs font-mono uppercase tracking-wider text-muted">For</dt><dd className="text-secondary mt-0.5">{s.forWho}</dd></div>
                      <div><dt className="text-xs font-mono uppercase tracking-wider text-muted">How CIMP-BIIF helps</dt><dd className="text-secondary mt-0.5">{s.howWeHelp}</dd></div>
                    </dl>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-5 text-sm font-body font-semibold text-brand hover:text-navy">
                      Official guidelines ↗<span className="sr-only"> for {s.name} (opens in a new tab)</span>
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-16">
          <SectionHeading eyebrow="Getting help" title="How we support scheme applications" />
          <ol className="grid md:grid-cols-3 gap-5">
            {[
              ["Check fit", "We review your stage, sector and registration against each scheme's criteria."],
              ["Prepare", "Mentors help you shape the proposal, budget and milestones."],
              ["Submit & follow up", "You submit on the scheme's official portal; we help you follow up and keep your milestones on track."],
            ].map(([t, d], i) => (
              <li key={t} className="bg-white border border-border rounded-2xl p-6 shadow-card">
                <span className="w-9 h-9 rounded-full bg-brand text-white font-mono font-bold flex items-center justify-center">{i + 1}</span>
                <h3 className="font-body font-semibold text-navy mt-4">{t}</h3>
                <p className="text-sm text-secondary font-body mt-2">{d}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <CtaBand title="Want help with a scheme?" desc="Apply to a CIMP-BIIF program and we will guide you through the right schemes." />
      <PublicFooter />
    </main>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
