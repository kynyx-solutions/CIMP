// Public ID-card verification (PRD IDC-1): anyone holding a card can be checked here.
// Shows only what is printed on the card itself; never contact details.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CARD_NUMBER } from "@/lib/idcard-number";
import { PublicHeader, PublicFooter } from "@/components/public/Site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify an ID card", robots: { index: false } };

export default async function VerifyPage({ params }: { params: { number: string } }) {
  const number = CARD_NUMBER.test(params.number) ? params.number : null;
  const card = number ? await prisma.idCard.findUnique({ where: { number }, select: { number: true, holderName: true, role: true, organisation: true, issuedAt: true, expiresAt: true, status: true } }) : null;
  const valid = !!card && card.status === "active" && card.expiresAt > new Date();
  const state = !card ? "unknown" : valid ? "valid" : card.status === "revoked" ? "revoked" : "expired";
  const tone = { valid: "bg-leaf-50 border-leaf-200 text-leaf-800", expired: "bg-amber-50 border-amber-200 text-amber-800", revoked: "bg-red-50 border-red-200 text-red-700", unknown: "bg-red-50 border-red-200 text-red-700" }[state];
  const title = { valid: "Valid CIMP-BIIF ID card", expired: "This card has expired", revoked: "This card has been revoked", unknown: "No card with this number" }[state];
  const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <main className="min-h-screen bg-bg antialiased">
      <PublicHeader />
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="font-display text-3xl font-bold text-navy">Verify an ID card</h1>
        <div role="status" className={`mt-6 border rounded-2xl p-6 ${tone}`}>
          <p className="font-body font-bold text-lg">{state === "valid" ? "✓ " : "✕ "}{title}</p>
          {card && (
            <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-2 text-sm font-body text-navy">
              <dt className="text-muted">Card number</dt><dd className="font-mono">{card.number}</dd>
              <dt className="text-muted">Holder</dt><dd className="font-semibold">{card.holderName}</dd>
              <dt className="text-muted">Role</dt><dd>{card.role}</dd>
              {card.organisation && <><dt className="text-muted">Organisation</dt><dd>{card.organisation}</dd></>}
              <dt className="text-muted">Issued</dt><dd>{date(card.issuedAt)}</dd>
              <dt className="text-muted">Valid till</dt><dd>{date(card.expiresAt)}</dd>
            </dl>
          )}
        </div>
        <p className="mt-4 text-xs text-muted font-body">Questions about a card? Write to startup@cimp.ac.in.</p>
      </div>
      <PublicFooter />
    </main>
  );
}
