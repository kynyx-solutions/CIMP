// Loading and publishing form versions (PRD FORM-1…3). Server-only.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { str } from "@/lib/serialize";
import { defaultForm, FIELD_TYPES, isLocked, type FieldDef, type FormDef, type FormKey, type SectionDef } from "@/lib/forms";

/** The live version of a form: the newest published one, else the built-in default. */
export async function getForm(form: FormKey): Promise<FormDef> {
  const row = await prisma.formSchema.findFirst({ where: { form }, orderBy: { version: "desc" } });
  if (!row) return defaultForm(form);
  const body = row.fields as unknown as { sections: SectionDef[]; fields: FieldDef[] };
  return {
    form, version: row.version, sections: body.sections, fields: body.fields,
    note: row.note, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(),
  };
}

export async function listVersions(form: FormKey) {
  const rows = await prisma.formSchema.findMany({
    where: { form }, orderBy: { version: "desc" }, take: 50,
    select: { version: true, note: true, createdBy: true, createdAt: true, fields: true },
  });
  return rows.map((r) => ({
    version: r.version, note: r.note, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(),
    fieldCount: ((r.fields as any)?.fields ?? []).length,
  }));
}

const KEY_RE = /^[a-z][a-zA-Z0-9_]{1,40}$/;
const TYPES = new Set(FIELD_TYPES.map((t) => t.value));

/**
 * Validate an edited form against the built-in definition and normalise it.
 * Core fields must all be present with their key, type and locked properties unchanged.
 */
export function normaliseForm(form: FormKey, input: { sections?: unknown; fields?: unknown }):
  { def: { sections: SectionDef[]; fields: FieldDef[] }; error?: undefined } | { def?: undefined; error: string } {
  const base = defaultForm(form);
  const baseByKey = new Map(base.fields.map((f) => [f.key, f]));

  if (!Array.isArray(input.sections) || !Array.isArray(input.fields)) return { error: "sections and fields are required" };
  const sections: SectionDef[] = [];
  for (const s of input.sections as any[]) {
    const title = str(s?.title, 80);
    if (!title) return { error: "Every section needs a title" };
    if (sections.some((x) => x.title === title)) return { error: `Duplicate section "${title}"` };
    sections.push({ title, desc: str(s?.desc, 200) || undefined });
  }
  if (!sections.length) return { error: "The form needs at least one section" };
  if (input.fields.length > 80) return { error: "A form can have at most 80 fields" };

  const seen = new Set<string>();
  const fields: FieldDef[] = [];
  for (const raw of input.fields as any[]) {
    const key = str(raw?.key, 41);
    if (!KEY_RE.test(key)) return { error: `Invalid field key "${key}"` };
    if (seen.has(key)) return { error: `Duplicate field key "${key}"` };
    seen.add(key);
    const core = baseByKey.get(key)?.core ? baseByKey.get(key) : undefined;
    const label = str(raw?.label, 120);
    if (!label) return { error: `Field "${key}" needs a label` };
    const section = str(raw?.section, 80);
    if (!sections.some((s) => s.title === section)) return { error: `Field "${label}" is in an unknown section` };

    const type = (core ? core.type : raw?.type) as FieldDef["type"];
    if (!TYPES.has(type)) return { error: `Field "${label}" has an invalid type` };

    let options: string[] | undefined;
    if (type === "select" || type === "multiselect") {
      options = core && isLocked(core, "options") ? core.options
        : Array.isArray(raw?.options) ? Array.from(new Set((raw.options as unknown[]).map((o) => str(o, 80)).filter(Boolean))) : [];
      if (!options || options.length < 2) return { error: `"${label}" needs at least two options` };
      if (options.length > 40) return { error: `"${label}" can have at most 40 options` };
    }

    const maxLength = raw?.maxLength == null || raw.maxLength === "" ? undefined : Number(raw.maxLength);
    if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 5000))
      return { error: `"${label}": character limit must be between 1 and 5000` };

    const f: FieldDef = {
      key, label, type, section,
      required: core && isLocked(core, "required") ? core.required : raw?.required === true,
      options,
      placeholder: str(raw?.placeholder, 160) || undefined,
      help: str(raw?.help, 300) || undefined,
      maxLength: ["text", "textarea", "url", "tel", "email"].includes(type) ? maxLength ?? core?.maxLength : undefined,
      isPublic: core && isLocked(core, "isPublic") ? core.isPublic : (core?.neverPublic ? false : raw?.isPublic === true),
      ...(core ? { core: true, locked: core.locked, neverPublic: core.neverPublic } : {}),
    };
    fields.push(f);
  }
  const missing = base.fields.filter((f) => f.core && !seen.has(f.key));
  if (missing.length) return { error: `Built-in fields cannot be removed: ${missing.map((f) => f.label).join(", ")}` };
  // A section that still holds fields cannot disappear (enforced above); empty sections are allowed.
  return { def: { sections, fields } };
}

export async function publishForm(form: FormKey, def: { sections: SectionDef[]; fields: FieldDef[] }, note: string, actorName: string) {
  const latest = await prisma.formSchema.findFirst({ where: { form }, orderBy: { version: "desc" }, select: { version: true } });
  const version = (latest?.version ?? 0) + 1;
  await prisma.formSchema.create({
    data: { form, version, fields: def as unknown as Prisma.InputJsonValue, note: note || null, createdBy: actorName },
  });
  return version;
}
