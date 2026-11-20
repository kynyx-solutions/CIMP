// Split layout for login / register / verify-email: light brand panel (official
// logo + "incubation hive") and the form. No hooks, so client pages can use it.
import Link from "next/link";
import HexHive from "@/components/public/HexHive";
import { BrandMark, LOGO_SRC } from "@/components/public/Site";

const POINTS = [
  "Apply online in about 15 minutes",
  "Track every review stage and decision live",
  "Mentorship, seed-fund guidance and co-working",
];

export default function AuthShell({ title, subtitle, children }: {
  title: string; subtitle?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-bg antialiased">
      {/* Brand panel (desktop) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-leaf-50 via-white to-leaf-100 border-r border-border hidden lg:flex flex-col justify-between p-12 xl:p-16">
        <HexHive focus="left" />
        <Link href="/" className="relative self-start" aria-label="CIMP-BIIF home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="CIMP-BIIF: सर्व सिद्धि मूलम् उद्यमिता" width={150} height={185} className="w-[150px] h-auto rounded-xl" />
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl xl:text-5xl font-bold text-navy leading-tight">
            Grow your startup with <span className="hero-title-gradient">CIMP-BIIF</span>
          </h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-secondary font-body">
                <span className="w-6 h-6 rounded-full bg-leaf-100 border border-leaf-200 text-brand text-xs flex items-center justify-center" aria-hidden="true">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs font-body text-muted">
          CIMP Business Incubation and Innovation Foundation · Patna, Bihar
        </p>
      </section>

      {/* Form side */}
      <section className="flex flex-col min-h-screen">
        <div className="lg:hidden border-b border-border bg-white px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="CIMP-BIIF home">
            <BrandMark size={36} />
            <span className="font-body font-extrabold text-[#2B2B2B]">CIMP-BIIF</span>
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10">
          <div className="w-full max-w-md">
            <h1 className="font-display text-3xl font-bold text-navy">{title}</h1>
            {subtitle && <div className="text-secondary font-body text-sm mt-2">{subtitle}</div>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <p className="text-center text-xs text-muted font-body pb-6">
          <Link href="/privacy" className="hover:text-navy">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="hover:text-navy">Terms of Use</Link>
        </p>
      </section>
    </main>
  );
}

export const inputCls =
  "w-full bg-white border border-border rounded-xl px-4 py-3 text-navy font-body text-sm focus:outline-none focus:border-brand-2 focus:ring-4 focus:ring-leaf-100 transition placeholder:text-faint";

export const primaryBtn =
  "w-full py-3.5 rounded-xl text-white font-semibold font-body text-sm bg-brand hover:opacity-90 transition disabled:opacity-50 shadow-[0_4px_20px_rgba(63,122,22,0.3)]";
