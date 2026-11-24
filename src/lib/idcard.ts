// Virtual ID cards (PRD IDC-1). Server-only.
// Eligible: incubatees with an approved application, mentors with an approved profile.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { notify } from "@/lib/notify";
import { newCardNumber } from "@/lib/idcard-number";

export type Holder = { userId: string; name: string; email: string; role: string; roleLabel: string; organisation: string | null };

/** Everyone who may hold a card today, with what the card should say. */
export async function eligibleHolders(): Promise<Holder[]> {
  const [incubatees, mentors] = await Promise.all([
    prisma.user.findMany({ where: { role: "incubatee", applications: { some: { status: "approved" } } }, select: { id: true, name: true, email: true, applications: { where: { status: "approved" }, select: { startupName: true }, take: 1 } } }),
    prisma.user.findMany({ where: { role: "mentor", mentorProfile: { status: "approved" } }, select: { id: true, name: true, email: true, mentorProfile: { select: { investorStatus: true, organisation: true, headline: true } } } }),
  ]);
  return [
    ...incubatees.map((u) => ({ userId: u.id, name: u.name, email: u.email, role: "incubatee", roleLabel: "Incubatee founder", organisation: u.applications[0]?.startupName ?? null })),
    ...mentors.map((u) => ({ userId: u.id, name: u.name, email: u.email, role: "mentor", roleLabel: u.mentorProfile?.investorStatus === "approved" ? "Mentor & Investor" : "Mentor", organisation: u.mentorProfile?.organisation ?? u.mentorProfile?.headline ?? null })),
  ];
}

export async function isEligible(userId: string) {
  return (await eligibleHolders()).find((h) => h.userId === userId) ?? null;
}

export function verifyUrl(number: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/verify/${number}`;
}

/** Issue a new card or renew an existing one (same number, new validity). */
export async function issueCard(holder: Holder) {
  const { idCardTemplate: t } = await getContent();
  const months = Math.min(60, Math.max(1, Math.round(Number(t.validityMonths) || 12)));
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt); expiresAt.setMonth(expiresAt.getMonth() + months);
  const existing = await prisma.idCard.findUnique({ where: { userId: holder.userId } });
  const data = { holderName: holder.name, role: holder.roleLabel, organisation: holder.organisation, issuedAt, expiresAt, status: "active" };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const card = existing
        ? await prisma.idCard.update({ where: { userId: holder.userId }, data })
        : await prisma.idCard.create({ data: { ...data, userId: holder.userId, number: newCardNumber() } });
      return { card, renewed: !!existing };
    } catch (e: any) {
      if (e?.code !== "P2002" || existing) throw e; // number already taken (or a parallel issue): retry
    }
  }
  throw new Error("Could not allocate a card number");
}

/** Email the card PDF to its holder and record when. */
export async function emailCard(card: { id: string; userId: string; number: string }, renewed: boolean) {
  const pdf = await cardPdf(card.number);
  if (!pdf) return;
  await notify(card.userId, renewed ? "Your ID card is renewed" : "Your CIMP-BIIF ID card",
    `${renewed ? "Your virtual ID card has been renewed" : "Your virtual ID card is ready"}. It is attached as a PDF and can be downloaded from your profile at any time.`,
    "success", undefined, { ctaPath: "/profile", ctaLabel: "Open your profile", attachments: [{ filename: `CIMP-BIIF-ID-${card.number}.pdf`, content: Buffer.from(pdf), contentType: "application/pdf" }] });
  await prisma.idCard.update({ where: { id: card.id }, data: { lastEmailedAt: new Date() } });
}

const W = 242.6, H = 153; // CR80 card, 85.6 × 54 mm
const ACCENTS = { green: rgb(0.247, 0.478, 0.086), saffron: rgb(0.85, 0.47, 0.05), blue: rgb(0.12, 0.31, 0.55) } as const;
const GREEN = ACCENTS.green, DARK = rgb(0.11, 0.21, 0.06), MUTE = rgb(0.42, 0.47, 0.38), PALE = rgb(0.95, 0.97, 0.92), WHITE = rgb(1, 1, 1);

/** Two-page PDF at card size: front and back. Null when the card does not exist. */
export async function cardPdf(number: string): Promise<Uint8Array | null> {
  const card = await prisma.idCard.findUnique({ where: { number } });
  if (!card) return null;
  const { idCardTemplate: saved } = await getContent();
  const { CONTENT_DEFAULTS } = await import("@/lib/content");
  const t = { ...CONTENT_DEFAULTS.idCardTemplate, ...saved };
  // Incubatee and mentor cards use their own template (title and colour)
  const kind = card.role.startsWith("Incubatee") ? "incubatee" : "mentor";
  const tpl = { ...CONTENT_DEFAULTS.idCardTemplate[kind], ...(t[kind] ?? {}) };
  const ACC = ACCENTS[tpl.accent as keyof typeof ACCENTS] ?? GREEN;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "assets", "fonts");
  const reg = await doc.embedFont(await readFile(path.join(dir, "NotoSans-Regular.ttf")), { subset: true });
  const bold = await doc.embedFont(await readFile(path.join(dir, "NotoSans-Bold.ttf")), { subset: true });
  doc.setTitle(`CIMP-BIIF ID card ${card.number}`);
  const chars = new Set(reg.getCharacterSet());
  const safe = (s: string) => Array.from(s).map((c) => (chars.has(c.codePointAt(0)!) ? c : "?")).join("");
  const fit = (s: string, size: number, max: number, f = reg) => { let x = safe(s); while (x.length > 1 && f.widthOfTextAtSize(x, size) > max) x = x.slice(0, -2) + "…"; return x; };
  const wrap = (s: string, size: number, max: number) => {
    const out: string[] = []; let line = "";
    for (const w of safe(s).split(/\s+/)) { const n = line ? `${line} ${w}` : w; if (reg.widthOfTextAtSize(n, size) <= max) line = n; else { if (line) out.push(line); line = w; } }
    if (line) out.push(line); return out;
  };
  const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const expired = card.status !== "active" || card.expiresAt < new Date();

  // Front
  const f = doc.addPage([W, H]);
  f.drawRectangle({ x: 0, y: 0, width: W, height: H, color: WHITE });
  f.drawRectangle({ x: 0, y: H - 34, width: W, height: 34, color: ACC });
  f.drawText("CIMP-BIIF", { x: 12, y: H - 22, size: 12, font: bold, color: WHITE });
  f.drawText(fit(tpl.cardTitle, 7.5, 110), { x: W - 12 - reg.widthOfTextAtSize(fit(tpl.cardTitle, 7.5, 110), 7.5), y: H - 21, size: 7.5, font: reg, color: WHITE });
  const initials = card.holderName.replace(/^.*:\s*/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  f.drawCircle({ x: 34, y: 66, size: 22, color: PALE, borderColor: ACC, borderWidth: 1 });
  f.drawText(safe(initials), { x: 34 - bold.widthOfTextAtSize(safe(initials), 14) / 2, y: 61, size: 14, font: bold, color: ACC });
  f.drawText(fit(card.holderName, 11, 170, bold), { x: 66, y: 88, size: 11, font: bold, color: DARK });
  f.drawText(fit(card.role, 8, 170), { x: 66, y: 75, size: 8, font: reg, color: ACC });
  if (card.organisation) f.drawText(fit(card.organisation, 8, 170), { x: 66, y: 63, size: 8, font: reg, color: MUTE });
  f.drawText("ID", { x: 66, y: 46, size: 6, font: bold, color: MUTE });
  f.drawText(card.number, { x: 78, y: 46, size: 7.5, font: bold, color: DARK });
  f.drawLine({ start: { x: 12, y: 30 }, end: { x: W - 12, y: 30 }, thickness: 0.4, color: PALE });
  f.drawText(`Issued ${date(card.issuedAt)}`, { x: 12, y: 16, size: 6.5, font: reg, color: MUTE });
  const valid = expired ? "NOT VALID" : `Valid till ${date(card.expiresAt)}`;
  f.drawText(valid, { x: W - 12 - bold.widthOfTextAtSize(valid, 7), y: 16, size: 7, font: bold, color: expired ? rgb(0.7, 0.14, 0.1) : ACC });

  // Back
  const b = doc.addPage([W, H]);
  b.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: ACC });
  let y = H - 22;
  for (const line of wrap(t.terms, 6.5, W - 24).slice(0, 5)) { b.drawText(line, { x: 12, y, size: 6.5, font: reg, color: DARK }); y -= 9; }
  b.drawText("Verify this card", { x: 12, y: 58, size: 6.5, font: bold, color: MUTE });
  b.drawText(fit(verifyUrl(card.number), 6.5, W - 24), { x: 12, y: 49, size: 6.5, font: reg, color: ACC });
  b.drawLine({ start: { x: W - 110, y: 32 }, end: { x: W - 12, y: 32 }, thickness: 0.5, color: MUTE });
  b.drawText(fit(t.signatoryName, 7, 98, bold), { x: W - 110, y: 23, size: 7, font: bold, color: DARK });
  wrap(t.signatoryTitle, 5.5, 98).slice(0, 2).forEach((line, i) => b.drawText(line, { x: W - 110, y: 15 - i * 7, size: 5.5, font: reg, color: MUTE }));
  wrap(t.issuerLine, 5.5, 110).slice(0, 2).forEach((line, i) => b.drawText(line, { x: 12, y: 23 - i * 7, size: 5.5, font: reg, color: MUTE }));
  return doc.save();
}
