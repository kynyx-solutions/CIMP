import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter, SectionHeading, SampleTag, Arrow } from "@/components/public/Site";
import { FAQS, SITE } from "@/content/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Answers about eligibility, the review process, terms and support at ${SITE.name}.`,
};

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-20">
        <SectionHeading as="h1" eyebrow="Help" title="Frequently asked questions" desc="Can't find your answer? Ask us from the contact section below, or through Messages once you have applied." />

        <div className="space-y-10">
          {FAQS.map((group) => (
            <section key={group.category} aria-labelledby={`faq-${group.category}`}>
              <h2 id={`faq-${group.category}`} className="font-display text-2xl font-semibold text-navy mb-4">
                {group.category} <SampleTag />
              </h2>
              <div className="space-y-3">
                {group.items.map((item) => (
                  // Native <details>: accessible and works without JavaScript
                  <details key={item.q} className="group bg-white border border-border rounded-xl shadow-card open:shadow-card-md">
                    <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-5 py-4 flex items-center justify-between gap-4 font-body font-semibold text-navy">
                      {item.q}
                      <span className="text-brand text-xl leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="px-5 pb-5 -mt-1 text-sm text-secondary font-body leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 bg-navy rounded-2xl p-8 text-center">
          <h2 className="font-display text-2xl font-semibold text-white">Ready to apply?</h2>
          <p className="text-blue-100 font-body mt-2 text-sm">It takes about 15 minutes, and you can track every step online.</p>
          <Link href="/register" className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-navy font-semibold font-body hover:bg-blue-50">
            Apply for Incubation <Arrow />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
