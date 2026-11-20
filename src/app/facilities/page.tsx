import type { Metadata } from "next";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SectionHeading, Check } from "@/components/public/Site";
import { FACILITIES, IS_SAMPLE, ADDRESS } from "@/content/site";

export const metadata: Metadata = {
  title: "Facilities",
  description: "B-Hub Patna, co-working, meeting rooms and labs available to CIMP-BIIF incubatees, and how to book them.",
};

export default function FacilitiesPage() {
  const { bhub } = FACILITIES;
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow="Infrastructure" title="Facilities for building and testing" desc={FACILITIES.intro} />

      {/* B-Hub highlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10">
        <article className="bg-white border border-border rounded-3xl shadow-card-md overflow-hidden grid lg:grid-cols-[1.1fr_1fr]">
          <div className="p-6 sm:p-10">
            <p className="text-xs font-mono uppercase tracking-wider text-brand font-semibold">Startup hub</p>
            <h2 className="font-display text-3xl font-bold text-navy mt-1">{bhub.name}</h2>
            <p className="text-sm font-mono text-muted mt-1">📍 {bhub.location}</p>
            <p className="text-secondary font-body mt-4 leading-relaxed">{bhub.summary}</p>
          </div>
          <div className="bg-surface-2 border-t lg:border-t-0 lg:border-l border-border p-6 sm:p-10">
            <h3 className="font-body font-semibold text-navy mb-3">What B-Hub offers</h3>
            <ul className="space-y-2.5">
              {bhub.features.map((f) => <li key={f} className="flex gap-2 text-sm font-body text-secondary"><Check />{f}</li>)}
            </ul>
          </div>
        </article>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <SectionHeading eyebrow="Spaces" title="Spaces at the centre" sample={IS_SAMPLE} />
        <ul className="grid md:grid-cols-3 gap-5">
          {FACILITIES.spaces.map((s) => (
            <li key={s.name} className="bg-white border border-border rounded-2xl p-6 shadow-card">
              <h3 className="font-body font-semibold text-lg text-navy">{s.name}</h3>
              <p className="text-sm text-secondary font-body mt-2">{s.detail}</p>
              <p className="text-xs font-mono text-muted mt-4">{s.capacity}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <SectionHeading eyebrow="Labs" title="Labs and equipment" desc="Equipment lists are indicative for the demo; CIMP will publish the actual inventory." sample={IS_SAMPLE} />
        <div className="grid md:grid-cols-3 gap-5">
          {FACILITIES.labs.map((l) => (
            <article key={l.name} className="bg-white border border-border rounded-2xl p-6 shadow-card">
              <h3 className="font-body font-semibold text-navy">{l.name}</h3>
              <ul className="mt-4 space-y-2">
                {l.items.map((it) => <li key={it} className="flex gap-2 text-sm font-body text-secondary"><Check />{it}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionHeading eyebrow="Booking" title="How to book" />
            <ul className="space-y-3">
              {FACILITIES.booking.map((b) => <li key={b} className="flex gap-2 font-body text-secondary"><Check />{b}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl p-6 sm:p-8 bg-navy text-white">
            <h2 className="font-display text-2xl font-bold">Visit the centre</h2>
            <p className="text-leaf-100 font-body mt-2">{ADDRESS}</p>
            <p className="text-sm text-leaf-200 font-body mt-4">Email: <a href="mailto:startup@cimp.ac.in" className="underline">startup@cimp.ac.in</a></p>
            <p className="text-sm text-leaf-200 font-body mt-2">Planned for Phase 1: room and lab booking inside the portal.</p>
          </div>
        </div>
      </section>

      <CtaBand />
      <PublicFooter />
    </main>
  );
}
