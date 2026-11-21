// Form builder model (PRD FORM-1…3). Shared by client and server; no server imports.
//
// A form has sections and fields. "Core" fields are built in and stored in table columns
// (directory filters and workflow rely on them): Admin IT may relabel them and choose
// whether they are public, but cannot remove them or change their type. Custom fields
// are added by Admin IT and stored in the record's `answers` JSON, so adding or removing
// a field needs no database migration (FORM-2). Every publish creates a new version.
import { APPLICATION_SECTIONS, INDUSTRIES } from "@/lib/application-fields";

export type FormKey = "application" | "mentor";
export const FORM_KEYS: FormKey[] = ["application", "mentor"];
export const FORM_LABELS: Record<FormKey, string> = { application: "Incubation application", mentor: "Mentor / investor profile" };

export type FieldType = "text" | "textarea" | "select" | "multiselect" | "number" | "date" | "url" | "tel" | "email";
export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Single choice" },
  { value: "multiselect", label: "Multiple choice" },
  { value: "url", label: "Link (URL)" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
];

/** Properties of a core field Admin IT may not change. */
export type LockableProp = "required" | "options" | "isPublic";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  section: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  maxLength?: number;
  /** shown on the public directory / profile (FORM-3) */
  isPublic?: boolean;
  /** built-in field stored in a column */
  core?: boolean;
  locked?: LockableProp[];
  /** never allowed on public pages (personal contact data, DPDP) */
  neverPublic?: boolean;
}

export interface SectionDef { title: string; desc?: string }

export interface FormDef {
  form: FormKey;
  version: number;
  sections: SectionDef[];
  fields: FieldDef[];
  note?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

// ── Defaults (version 0): the demo's built-in forms ─────────────────────────

const APP_PUBLIC = new Set(["startupName", "industry", "ventureStage", "city", "state", "website", "idea"]);
const APP_LOCKED: Record<string, LockableProp[]> = {
  startupName: ["required", "isPublic"],
  industry: ["required", "options", "isPublic"], // mentor sectors and directory filter use the same list
  idea: ["required", "isPublic"],                 // the directory card text
};

export function defaultForm(form: FormKey): FormDef {
  if (form === "application") {
    return {
      form, version: 0,
      sections: APPLICATION_SECTIONS.map((s) => ({ title: s.title, desc: s.desc })),
      fields: APPLICATION_SECTIONS.flatMap((s) => s.fields.map((f) => ({
        ...f, section: s.title, core: true,
        isPublic: APP_PUBLIC.has(f.key),
        locked: APP_LOCKED[f.key],
        neverPublic: f.key === "phone" || undefined,
      }))) as FieldDef[],
    };
  }
  const p = "Profile", inv = "Investor details";
  return {
    form, version: 0,
    sections: [{ title: p, desc: "Shown to incubatees and, if you opt in, on the public site." }, { title: inv, desc: "Only for approved investors." }],
    fields: [
      { key: "headline", label: "Headline", type: "text", section: p, required: true, core: true, isPublic: true, locked: ["required", "isPublic"], maxLength: 120 },
      { key: "organisation", label: "Organisation", type: "text", section: p, core: true, isPublic: true, maxLength: 120 },
      { key: "yearsExperience", label: "Years of experience", type: "number", section: p, core: true, isPublic: true },
      { key: "expertise", label: "Expertise", type: "textarea", section: p, required: true, core: true, isPublic: true, locked: ["required", "isPublic"], maxLength: 600 },
      { key: "sectors", label: "Sectors", type: "multiselect", section: p, required: true, core: true, isPublic: true, options: INDUSTRIES.filter((i) => i !== "Other"), locked: ["required", "options", "isPublic"] },
      { key: "bio", label: "Short bio", type: "textarea", section: p, core: true, isPublic: true, maxLength: 2000 },
      { key: "linkedin", label: "LinkedIn", type: "url", section: p, core: true, isPublic: true, maxLength: 200 },
      { key: "investorThesis", label: "Investment focus", type: "textarea", section: inv, core: true, isPublic: true, maxLength: 1500 },
      { key: "ticketSize", label: "Typical ticket size", type: "text", section: inv, core: true, isPublic: true, maxLength: 80 },
    ],
  };
}

/** Custom (non-core) fields: what Admin IT added. */
export const customFields = (def: FormDef) => def.fields.filter((f) => !f.core);
export const publicFields = (def: FormDef) => def.fields.filter((f) => f.isPublic && !f.neverPublic);
export const isLocked = (f: FieldDef, prop: LockableProp) => !!f.core && !!f.locked?.includes(prop);

// ── Validation of answers against a form (used by the API) ──────────────────

export type AnswerValue = string | number | string[] | null;

/**
 * Validate `body` against `fields`. Returns clean values keyed by field key, or an error.
 * `partial`: only keys present in `body` are validated (office corrections).
 */
export function validateFields(fields: FieldDef[], body: Record<string, unknown>, opts: { partial?: boolean } = {}):
  { data: Record<string, AnswerValue>; error?: undefined } | { data?: undefined; error: string } {
  const data: Record<string, AnswerValue> = {};
  for (const f of fields) {
    const raw = body[f.key];
    if (raw === undefined && opts.partial) continue;

    if (f.type === "multiselect") {
      const list = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
      if (!list.length) { if (f.required) return { error: `${f.label} is required` }; data[f.key] = []; continue; }
      if (f.options && list.some((x) => !f.options!.includes(x))) return { error: `Choose valid options for ${f.label.toLowerCase()}` };
      data[f.key] = Array.from(new Set(list));
      continue;
    }

    const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (f.required) return { error: `${f.label} is required` };
      data[f.key] = null;
      continue;
    }
    if (f.maxLength && value.length > f.maxLength) return { error: `${f.label} is too long (max ${f.maxLength} characters)` };
    switch (f.type) {
      case "select":
        if (f.options && !f.options.includes(value)) return { error: `Choose a valid ${f.label.toLowerCase()}` };
        break;
      case "number": {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 1e9) return { error: `${f.label} must be a number` };
        data[f.key] = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
        continue;
      }
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return { error: `${f.label} must be a valid date` };
        break;
      case "url":
        if (!/^https?:\/\/\S+\.\S+/.test(value)) return { error: `${f.label} must start with http:// or https://` };
        break;
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: `${f.label} must be a valid email` };
        break;
      case "tel":
        if (!/^[+\d][\d\s-]{5,19}$/.test(value)) return { error: `${f.label} must be a valid phone number` };
        break;
    }
    data[f.key] = value;
  }
  return { data };
}

/** Read a field's value from a record (core column, else custom answer). */
export function valueOf(record: Record<string, any> | null | undefined, f: FieldDef): AnswerValue | undefined {
  if (!record) return undefined;
  return f.core ? record[f.key] : record.answers?.[f.key];
}

export function displayValue(v: AnswerValue | undefined): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}
