import Link from "next/link";
import { PublicHeader, PublicFooter, PageHero } from "@/components/public/Site";
import { LEGAL_UPDATED } from "@/content/legal";

// Shared layout for the Privacy Policy and Terms of Use pages.
export default function LegalPage({ eyebrow, title, desc, sections, other }: {
  eyebrow: string; title: string; desc: string;
  sections: { title: string; body: string[] }[];
  other: { href: string; label: string };
}) {
  const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <PageHero eyebrow={eyebrow} title={title} desc={desc} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-12 relative z-10 pb-20 grid lg:grid-cols-[220px_1fr] gap-8 items-start">
        <nav aria-label="On this page" className="hidden lg:block sticky top-24 bg-white border border-border rounded-2xl p-4 shadow-card">
          <p className="text-xs font-mono uppercase tracking-wider text-muted mb-2">On this page</p>
          <ul className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.title}><a href={`#${id(s.title)}`} className="text-sm font-body text-secondary hover:text-brand">{s.title}</a></li>
            ))}
          </ul>
        </nav>
        <article className="bg-white border border-border rounded-2xl shadow-card p-6 sm:p-10">
          <p role="note" className="text-sm font-body text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-8">
            <strong>Draft for the demo.</strong> This text must be reviewed and approved by CIMP&apos;s legal counsel before go-live. Items in [brackets] are to be provided by CIMP.
          </p>
          <p className="text-xs font-mono text-muted mb-6">Last updated: {LEGAL_UPDATED}</p>
          {sections.map((s) => (
            <section key={s.title} id={id(s.title)} className="scroll-mt-24 mb-8 last:mb-0">
              <h2 className="font-display text-2xl font-bold text-navy mb-3">{s.title}</h2>
              {s.body.map((p, i) => <p key={i} className="font-body text-secondary leading-relaxed mb-3">{p}</p>)}
            </section>
          ))}
          <p className="mt-10 pt-6 border-t border-border text-sm font-body text-muted">
            See also: <Link href={other.href} className="text-brand underline">{other.label}</Link>
          </p>
        </article>
      </div>
      <PublicFooter />
    </main>
  );
}
