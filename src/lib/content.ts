// Website content Admin IT edits from the admin panel (PRD WEB-6). Server-only.
// Each key has a default in src/content/site.ts; a SiteConfig row overrides it.
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATS, OPEN_CALLS, ELIGIBILITY, CONTACTS, FAQS } from "@/content/site";

export const CONTENT_DEFAULTS = {
  sampleMode: { enabled: true },
  stats: STATS,
  openCalls: OPEN_CALLS,
  eligibility: ELIGIBILITY,
  contacts: CONTACTS,
  faqs: FAQS,
  // Virtual ID card template (PRD IDC-1)
  idCardTemplate: {
    cardTitle: "Member ID card",
    validityMonths: 12,
    signatoryName: "Kumod Kumar",
    signatoryTitle: "Chief Executive Officer, CIMP-BIIF",
    issuerLine: "CIMP-BIIF, Mithapur Institutional Area, Patna 800001",
    terms: "This card identifies the holder as a member of the CIMP-BIIF incubation network. It is not transferable. Verify it at the link on this card.",
  },
};

export type ContentKey = keyof typeof CONTENT_DEFAULTS;
export type SiteContent = { [K in ContentKey]: (typeof CONTENT_DEFAULTS)[K] };
export const CONTENT_KEYS = Object.keys(CONTENT_DEFAULTS) as ContentKey[];

export const CONTENT_META: Record<ContentKey, { label: string; desc: string; where: string }> = {
  sampleMode: { label: "Sample labels", desc: "Show the demo banner and “Sample” tags. Turn off once CIMP's real content is in.", where: "Every public page" },
  stats: { label: "Impact numbers", desc: "Headline numbers with their source and date.", where: "Home, About" },
  openCalls: { label: "Open calls", desc: "Current intakes with deadlines and links.", where: "Home, How to apply" },
  eligibility: { label: "Eligibility", desc: "Who can apply, one point per line.", where: "Home, How to apply" },
  contacts: { label: "Contacts", desc: "Contact by audience.", where: "Footer on every public page" },
  faqs: { label: "FAQ", desc: "Questions grouped by category.", where: "FAQ page" },
  idCardTemplate: { label: "ID card template", desc: "Text and validity of the virtual ID cards issued to incubatees and mentors.", where: "ID card PDFs and the verification page" },
};

/** All site content for this request: database overrides on top of the defaults. */
export const getContent = cache(async (): Promise<SiteContent> => {
  const content = { ...CONTENT_DEFAULTS } as SiteContent;
  try {
    const rows = await prisma.siteConfig.findMany();
    for (const r of rows) if (r.key in content) (content as any)[r.key] = r.value;
  } catch {
    // Database unavailable: the site still renders with its defaults.
  }
  return content;
});

// ── Validation: an edit must keep the shape of the default ───────────────────

const MAX_STR = 2000;
const MAX_ITEMS = 60;

/** Check `value` has the same shape as `template` (keys, types, array element shape). Returns an error or null. */
export function checkShape(template: unknown, value: unknown, path = "value"): string | null {
  if (typeof template === "string") {
    if (typeof value !== "string") return `${path} must be text`;
    if (value.length > MAX_STR) return `${path} is too long`;
    return null;
  }
  if (typeof template === "boolean") return typeof value === "boolean" ? null : `${path} must be yes/no`;
  if (typeof template === "number") return typeof value === "number" && Number.isFinite(value) ? null : `${path} must be a number`;
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return `${path} must be a list`;
    if (value.length > MAX_ITEMS) return `${path} has too many items (max ${MAX_ITEMS})`;
    const item = template[0];
    if (item === undefined) return null;
    for (let i = 0; i < value.length; i++) {
      const err = checkShape(item, value[i], `${path}[${i + 1}]`);
      if (err) return err;
    }
    return null;
  }
  if (template && typeof template === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return `${path} must be a group of fields`;
    const t = template as Record<string, unknown>, v = value as Record<string, unknown>;
    for (const k of Object.keys(t)) {
      const err = checkShape(t[k], v[k], `${path}.${k}`);
      if (err) return err;
    }
    const extra = Object.keys(v).filter((k) => !(k in t));
    if (extra.length) return `${path} has unknown fields: ${extra.join(", ")}`;
    return null;
  }
  return `${path} has an unsupported type`;
}

/** Trim every string so stray whitespace does not reach the site. */
export function trimDeep<T>(v: T): T {
  if (typeof v === "string") return v.trim() as T;
  if (Array.isArray(v)) return v.map(trimDeep) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimDeep(x)])) as T;
  return v;
}

export async function saveContent(key: ContentKey, value: unknown, by: string) {
  await prisma.siteConfig.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue, updatedBy: by },
    update: { value: value as Prisma.InputJsonValue, updatedBy: by },
  });
}

export async function resetContent(key: ContentKey) {
  await prisma.siteConfig.deleteMany({ where: { key } });
}
