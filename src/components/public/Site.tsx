// Shared building blocks for public (logged-out) pages: header, footer, headings.
import Link from "next/link";
import Image from "next/image";
import { SITE, SOCIAL } from "@/content/site";
import { getContent } from "@/lib/content";
import HexHive from "@/components/public/HexHive";

export const LOGO_SRC = "/brand/cimp-biif-logo.jpg"; // official logo, 462×571

export const PUBLIC_NAV = [
  { href: "/about", label: "About" },
  { href: "/programs", label: "Programs" },
  { href: "/how-to-apply", label: "How to Apply" },
  { href: "/startups", label: "Startups" },
  { href: "/mentors", label: "Mentors" },
  { href: "/facilities", label: "Facilities" },
  { href: "/schemes", label: "Schemes" },
  { href: "/faq", label: "FAQ" },
];

/** Bodhi-tree mark: the circular tree from the official logo, cropped (text below it hidden). */
export function BrandMark({ size = 40 }: { size?: number }) {
  // The tree circle occupies the top ~77% of the logo image.
  return (
    <span className="inline-block overflow-hidden flex-shrink-0" style={{ width: size, height: Math.round(size * 0.95) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_SRC} alt="" width={size} height={Math.round((size * 571) / 462)} className="block max-w-none" />
    </span>
  );
}

/** Light banner at the top of each public sub-page, with the "incubation hive" in logo greens. */
export function PageHero({ eyebrow, title, desc, children }: {
  eyebrow: string; title: string; desc?: string; children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-leaf-50 to-white border-b border-border">
      <HexHive focus="left" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-24 md:pt-20 md:pb-28">
        <p className="text-saffron-600 text-xs font-mono tracking-[0.15em] uppercase font-semibold mb-4">{eyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-navy max-w-2xl leading-tight">{title}</h1>
        {desc && <p className="text-secondary font-body text-lg mt-4 max-w-2xl leading-relaxed">{desc}</p>}
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
        <h2 className="font-display text-3xl md:text-4xl font-bold text-white">{title}</h2>
        <p className="text-leaf-100 font-body mt-3">{desc}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/register" className="px-7 py-3.5 rounded-xl bg-white text-navy font-semibold font-body hover:bg-leaf-50 transition-colors inline-flex items-center justify-center gap-2">
            Apply for Incubation <Arrow />
          </Link>
          <Link href="/faq" className="px-7 py-3.5 rounded-xl border border-leaf-300/40 text-white font-body hover:bg-white/10 transition-colors">
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

// Hidden once Admin IT turns off sample mode (PRD WEB-6)
export async function SampleTag() {
  const { sampleMode } = await getContent();
  return sampleMode.enabled ? (
    <span className="ml-2 align-middle text-[10px] font-mono uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
      Sample
    </span>
  ) : null;
}

export function SectionHeading({ eyebrow, title, desc, sample, as = "h2" }: {
  eyebrow: string; title: string; desc?: string; sample?: boolean; as?: "h1" | "h2";
}) {
  const H = as;
  return (
    <div className="max-w-2xl mb-10">
      <p className="text-brand text-xs font-mono tracking-[0.15em] uppercase font-semibold mb-3">{eyebrow}</p>
      <H className={`font-display ${as === "h1" ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"} font-bold text-navy tracking-tight`}>
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
      <BrandMark size={40} />
      <span className="flex flex-col leading-none">
        <span className="font-body text-lg font-extrabold tracking-wide text-[#2B2B2B]">{SITE.name}</span>
        <span className="text-[11px] font-body text-saffron-600 mt-1" lang="sa">सर्व सिद्धि मूलम् उद्यमिता</span>
      </span>
    </Link>
  );
}

export async function PublicHeader() {
  const { sampleMode } = await getContent();
  return (
    <>
      {sampleMode.enabled && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-body text-center px-4 py-2">
          Demo build: content marked <strong>Sample</strong> is placeholder until Admin IT publishes CIMP&apos;s real data.
        </div>
      )}
      <header className="bg-white/90 backdrop-blur-lg border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden xl:flex items-center gap-0.5" aria-label="Main">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-secondary hover:text-navy text-sm font-body px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden sm:flex items-center gap-2 ml-auto xl:ml-0">
            <Link href="/login" className="text-secondary hover:text-navy text-sm font-body px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">Login</Link>
            <Link href="/register" className="px-5 py-2 rounded-lg text-white text-sm font-semibold font-body bg-brand hover:opacity-90 transition-opacity">Apply</Link>
          </div>
          {/* Mobile menu: works without JavaScript */}
          <details className="xl:hidden relative">
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

export async function PublicFooter() {
  const { contacts: CONTACTS } = await getContent();
  const year = new Date().getFullYear();
  return (
    <footer id="contact" className="bg-white border-t border-border scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-[1.2fr_2fr]">
        <div>
          {/* Partner logos supplied by CIMP-BIIF: CIMP | CIMP-BIIF | Udyog Vibhag (Department of Industries, Govt. of Bihar) */}
          <div className="inline-block rounded-xl border border-border bg-white p-2">
            <Image src="/brand/partner-logos.png" alt="CIMP, CIMP-BIIF and Udyog Vibhag (Department of Industries, Government of Bihar)"
              width={1520} height={574} sizes="(max-width: 640px) 90vw, 360px" className="w-[300px] sm:w-[360px] h-auto" />
          </div>
          <p className="text-xs text-muted font-body mt-2 max-w-sm">Supported by the Department of Industries, Government of Bihar.</p>
          <p className="text-sm text-secondary font-body mt-3 max-w-sm">{SITE.fullName}, an initiative of {SITE.hostInstitute}.</p>
          <nav className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm font-body text-muted hover:text-navy">{n.label}</Link>
            ))}
          </nav>
          <ul className="mt-4 flex gap-3" aria-label="Social media">
            {SOCIAL.map((s) => (
              <li key={s.label}><a href={s.href} target="_blank" rel="noopener noreferrer" className="text-sm font-body text-brand hover:text-navy">{s.label} ↗</a></li>
            ))}
          </ul>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p className="text-xs font-mono text-faint">© {year} {SITE.name}. All rights reserved.</p>
          <p className="text-xs font-body text-muted flex gap-4">
            <Link href="/privacy" className="hover:text-navy">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-navy">Terms of Use</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
