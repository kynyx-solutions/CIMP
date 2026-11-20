import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader, PublicFooter, PageHero, CtaBand, SectionHeading, SampleTag, Check, Arrow } from "@/components/public/Site";
import { APPLY_STEPS, ELIGIBILITY, APPLY_GUIDE, OPEN_CALLS, RESPONSE_TIME } from "@/content/site";

export const metadata: Metadata = {
  title: "How to Apply",
  description: "Eligibility, documents, the four-stage review and what happens after selection at CIMP-BIIF.",
};

// Who acts at each step, shown next to the step (mirrors src/lib/workflow.ts).
const STEP_OWNER = ["You", "Executive", "Incubation Manager", "Senior Manager & CEO"];

export default function HowToApplyPage() {
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow="How to apply" title="Apply online, track every step"
        desc="No email chains or external forms. You apply in the portal and see each review stage and decision as it happens.">
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-navy font-semibold font-body bg-gradient-to-r from-cyan-300 to-blue-300 shadow-[0_0_28px_rgba(103,232,249,0.4)]">
            Start your application <Arrow />
          </Link>
          <Link href="/programs" className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/25 bg-white/5 text-white font-body hover:bg-white/10">
            Compare programs
          </Link>
        </div>
      </PageHero>

      {/* Open calls */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-12 relative z-10">
        <div className="bg-white border border-border rounded-2xl shadow-card-md p-5">
          <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-muted font-semibold mb-3">Open calls <SampleTag /></h2>
          <ul className="grid sm:grid-cols-3 gap-3">
            {OPEN_CALLS.map((c) => (
              <li key={c.title} className="rounded-xl border border-border bg-surface-2 px-4 py-3">
                <p className="font-body font-semibold text-navy text-sm">{c.title}</p>
                <p className="font-mono text-xs text-muted mt-0.5">Deadline: {c.deadline}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <SectionHeading eyebrow="The process" title="Four stages, fully on record" desc={`${RESPONSE_TIME}, with email and in-app notifications.`} />
        <ol className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {APPLY_STEPS.map((s, i) => (
            <li key={s.title} className="relative bg-white border border-border rounded-2xl p-6 shadow-card">
              <span className="w-10 h-10 rounded-full bg-brand text-white font-mono font-bold flex items-center justify-center">{i + 1}</span>
              <h3 className="font-body font-semibold text-navy mt-4">{s.title}</h3>
              <p className="text-xs font-mono text-brand mt-1">{STEP_OWNER[i]}</p>
              <p className="text-sm text-secondary font-body mt-2 leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Eligibility + documents */}
      <section className="border-t border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-10">
          <div>
            <SectionHeading eyebrow="Eligibility" title="Who can apply" sample />
            <ul className="space-y-3">
              {ELIGIBILITY.map((e) => <li key={e} className="flex gap-2 font-body text-secondary"><Check />{e}</li>)}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Before you start" title="Keep these ready" />
            <ul className="space-y-3">
              {APPLY_GUIDE.documents.map((d) => <li key={d} className="flex gap-2 font-body text-secondary"><Check />{d}</li>)}
            </ul>
          </div>
        </div>
      </section>

      {/* Tips + after selection */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-6">
          <div className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
            <h2 className="font-display text-2xl font-semibold text-navy">Tips for a strong application</h2>
            <ul className="mt-5 space-y-3">
              {APPLY_GUIDE.tips.map((t, i) => (
                <li key={t} className="flex gap-3 font-body text-secondary">
                  <span className="w-6 h-6 rounded-full bg-blue-50 border border-blue-100 text-brand text-xs font-mono flex items-center justify-center flex-shrink-0">{i + 1}</span>{t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl p-6 sm:p-8 bg-navy text-white">
            <h2 className="font-display text-2xl font-semibold">After you are selected</h2>
            <ul className="mt-5 space-y-3">
              {APPLY_GUIDE.afterSelection.map((a) => (
                <li key={a} className="flex gap-2 font-body text-blue-100">
                  <span className="text-cyan-300" aria-hidden="true">✓</span>{a}
                </li>
              ))}
            </ul>
            <p className="text-sm text-blue-200 font-body mt-6">
              Not selected? You will see the reason on your dashboard, and you can ask questions through Messages.
            </p>
          </div>
        </div>
      </section>

      <CtaBand title="Ready when you are" />
      <PublicFooter />
    </main>
  );
}
