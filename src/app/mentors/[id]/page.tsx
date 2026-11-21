// Public mentor / investor profile (PRD PUB-1, WEB-13): approved profiles whose owner
// opted in to public listing. No email or phone; incubatees connect through the portal.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isId } from "@/lib/serialize";
import { PublicHeader, PublicFooter, CtaBand } from "@/components/public/Site";
import { publicFields, customFields, displayValue, type AnswerValue } from "@/lib/forms";
import { getForm } from "@/lib/forms-server";

export const dynamic = "force-dynamic";

const getMentor = cache(async (id: string) => {
  if (!isId(id)) return null;
  return prisma.mentorProfile.findFirst({
    where: { id, status: "approved", isPublic: true },
    select: {
      id: true, headline: true, organisation: true, expertise: true, sectors: true, bio: true, linkedin: true,
      yearsExperience: true, investorStatus: true, investorThesis: true, ticketSize: true, answers: true,
      user: { select: { name: true } },
    },
  });
});

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await getMentor(params.id);
  if (!m) return { title: "Mentor not found" };
  return { title: m.user.name, description: `${m.user.name}, ${m.headline}. ${m.expertise}` };
}

export default async function MentorProfilePage({ params }: { params: { id: string } }) {
  const m = await getMentor(params.id);
  if (!m) notFound();
  const investor = m.investorStatus === "approved";
  // Only fields Admin IT made public (PRD FORM-3)
  const form = await getForm("mentor");
  const pub = new Set(publicFields(form).map((f) => f.key));
  const p = <T,>(key: string, v: T) => (pub.has(key) ? v : null);
  const organisation = p("organisation", m.organisation), years = p("yearsExperience", m.yearsExperience);
  const bio = p("bio", m.bio), linkedin = p("linkedin", m.linkedin);
  const thesis = p("investorThesis", m.investorThesis), ticket = p("ticketSize", m.ticketSize);
  const answers = (m.answers ?? {}) as Record<string, AnswerValue>;
  const extra = customFields(form).filter((f) => pub.has(f.key)).map((f) => ({ f, v: displayValue(answers[f.key]) })).filter((x) => x.v);

  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />

      <section className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="text-xs font-mono text-muted mb-6">
            <Link href="/mentors" className="hover:text-brand">Mentors &amp; investors</Link> <span aria-hidden="true">/</span> {m.user.name}
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-24 h-24 rounded-full bg-leaf-50 border-2 border-leaf-200 flex items-center justify-center font-display text-4xl font-bold text-brand flex-shrink-0" aria-hidden="true">
              {m.user.name.replace(/^.*:\s*/, "").replace(/^(Dr\.|Prof\.)\s*/, "").charAt(0)}
            </div>
            <div className="min-w-0">
              <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded-full border mb-2 ${investor ? "text-saffron-600 bg-saffron-50 border-saffron-100" : "text-brand bg-leaf-50 border-leaf-200"}`}>
                {investor ? "Mentor & Investor" : "Mentor"}
              </span>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-navy break-words">{m.user.name}</h1>
              <p className="text-secondary font-body mt-1">
                {m.headline}{organisation ? `, ${organisation}` : ""}
                {years != null && <span className="text-muted"> · {years} years&apos; experience</span>}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="space-y-6">
          <article className="bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-card">
            <h2 className="text-xs font-mono text-muted uppercase tracking-wider">Can help with</h2>
            <p className="font-body text-lg text-navy leading-relaxed mt-3">{m.expertise}</p>
            {bio && (
              <>
                <h2 className="text-xs font-mono text-muted uppercase tracking-wider mt-8">About</h2>
                <p className="font-body text-secondary leading-relaxed mt-3 whitespace-pre-line">{bio}</p>
              </>
            )}
            {extra.map(({ f, v }) => (
              <section key={f.key}>
                <h2 className="text-xs font-mono text-muted uppercase tracking-wider mt-8">{f.label}</h2>
                <p className="font-body text-secondary leading-relaxed mt-3 whitespace-pre-line break-words">{v}</p>
              </section>
            ))}
          </article>
          {investor && (thesis || ticket) && (
            <article className="bg-white border border-saffron-100 rounded-2xl p-6 sm:p-8 shadow-card">
              <h2 className="text-xs font-mono text-saffron-600 uppercase tracking-wider">Investment focus</h2>
              {thesis && <p className="font-body text-navy leading-relaxed mt-3">{thesis}</p>}
              {ticket && <p className="font-body text-sm text-secondary mt-3"><span className="font-semibold text-navy">Typical cheque:</span> {ticket}</p>}
            </article>
          )}
        </div>
        <aside className="bg-white border border-border rounded-2xl p-6 shadow-card space-y-5">
          <div>
            <p className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">Sectors</p>
            <ul className="flex flex-wrap gap-1.5">
              {m.sectors.map((s) => <li key={s} className="text-xs font-mono text-secondary bg-bg border border-border px-2 py-0.5 rounded-full">{s}</li>)}
            </ul>
          </div>
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noopener noreferrer nofollow" className="block text-sm font-body font-semibold text-brand hover:text-navy">LinkedIn profile ↗</a>
          )}
          <div className="pt-5 border-t border-border">
            <p className="text-sm font-body text-secondary">Incubated at CIMP-BIIF? Request a connection from the portal.</p>
            <Link href="/connect" className="mt-3 inline-flex w-full justify-center px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body hover:opacity-90">Request a connection</Link>
          </div>
        </aside>
      </div>

      <CtaBand />
      <PublicFooter />
    </main>
  );
}
