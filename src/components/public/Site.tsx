// Shared building blocks for public (logged-out) pages: header, footer, headings.
import Link from "next/link";
import { IS_SAMPLE, SITE, CONTACTS } from "@/content/site";
import HeroBackground from "@/components/public/HeroBackground";

export const PUBLIC_NAV = [
  { href: "/about", label: "About" },
  { href: "/programs", label: "Programs" },
  { href: "/how-to-apply", label: "How to Apply" },
  { href: "/startups", label: "Startups" },
  { href: "/schemes", label: "Schemes" },
  { href: "/faq", label: "FAQ" },
];

/** Dark banner at the top of each public sub-page (same visual language as the homepage hero). */
export function PageHero({ eyebrow, title, desc, children }: {
  eyebrow: string; title: string; desc?: string; children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[#081127]">
      <HeroBackground compact />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 md:pt-20 md:pb-28">
        <p className="text-cyan-200 text-xs font-mono tracking-[0.15em] uppercase font-semibold mb-4">{eyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-white max-w-2xl leading-tight drop-shadow-[0_2px_24px_rgba(59,130,246,0.35)]">{title}</h1>
        {desc && <p className="text-blue-100/90 font-body text-lg mt-4 max-w-2xl leading-relaxed">{desc}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

/** Closing call to action used at the bottom of public pages. */
export function CtaBand({ title = "Ready to build with CIMP-BIIF?", desc = "Apply in about 15 minutes and track every step of your review online." }: { title?: string; desc?: string }) {
  return (
    <section className="bg-navy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-white">{title}</h2>
        <p className="text-blue-100 font-body mt-3">{desc}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/register" className="px-7 py-3.5 rounded-xl bg-white text-navy font-semibold font-body hover:bg-blue-50 transition-colors inline-flex items-center justify-center gap-2">
            Apply for Incubation <Arrow />
          </Link>
          <Link href="/faq" className="px-7 py-3.5 rounded-xl border border-blue-300/40 text-white font-body hover:bg-white/10 transition-colors">
            Read the FAQ
          </Link>
        </div>
      </div>
    </section>
  );
}

export const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0 mt-0.5 text-brand">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const SampleTag = () =>
  IS_SAMPLE ? (
    <span className="ml-2 align-middle text-[10px] font-mono uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
      Sample
    </span>
  ) : null;

export function SectionHeading({ eyebrow, title, desc, sample, as = "h2" }: {
  eyebrow: string; title: string; desc?: string; sample?: boolean; as?: "h1" | "h2";
}) {
  const H = as;
  return (
    <div className="max-w-2xl mb-10">
      <p className="text-brand text-xs font-mono tracking-[0.15em] uppercase font-semibold mb-3">{eyebrow}</p>
      <H className={`font-display ${as === "h1" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"} font-semibold text-navy tracking-tight`}>
        {title}
        {sample && <SampleTag />}
      </H>
      {desc && <p className="text-secondary font-body mt-3 leading-relaxed">{desc}</p>}
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${SITE.name} home`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand">
        <span className="text-white font-bold text-sm font-display">C</span>
      </div>
      <span className="font-display text-xl font-semibold text-navy">{SITE.name}</span>
    </Link>
  );
}

export function PublicHeader() {
  return (
    <>
      {IS_SAMPLE && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-body text-center px-4 py-2">
          Demo build: content marked <strong>Sample</strong> is placeholder until Admin IT publishes CIMP&apos;s real data.
        </div>
      )}
      <header className="bg-white/90 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-secondary hover:text-navy text-sm font-body px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/login" className="text-secondary hover:text-navy text-sm font-body px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">Login</Link>
            <Link href="/register" className="px-5 py-2 rounded-lg text-white text-sm font-semibold font-body bg-brand hover:opacity-90 transition-opacity">Apply</Link>
          </div>
          {/* Mobile menu: works without JavaScript */}
          <details className="sm:hidden relative">
            <summary className="list-none [&::-webkit-details-marker]:hidden p-2 rounded-lg hover:bg-slate-50 text-navy cursor-pointer" aria-label="Open menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </summary>
            <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-card-lg p-2 flex flex-col">
              {PUBLIC_NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg text-sm font-body text-secondary hover:bg-slate-50">{n.label}</Link>
              ))}
              <Link href="/login" className="px-3 py-2 rounded-lg text-sm font-body text-secondary hover:bg-slate-50">Login</Link>
              <Link href="/register" className="mt-1 px-3 py-2 rounded-lg text-sm font-semibold font-body text-white bg-brand text-center">Apply</Link>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer id="contact" className="bg-white border-t border-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          <Logo />
          <p className="text-sm text-secondary font-body mt-3 max-w-sm">{SITE.fullName}</p>
          <nav className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm font-body text-muted hover:text-navy">{n.label}</Link>
            ))}
          </nav>
        </div>
        <div>
          <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-muted font-semibold mb-4">
            Contact by audience <SampleTag />
          </h2>
          <dl className="grid sm:grid-cols-2 gap-4">
            {CONTACTS.map((c) => (
              <div key={c.audience} className="border border-border rounded-xl p-4">
                <dt className="text-sm font-body font-semibold text-navy">{c.audience}</dt>
                <dd className="text-sm font-body text-muted mt-1">{c.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs font-mono text-faint">© {year} {SITE.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
