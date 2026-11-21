// Form definitions (PRD FORM-1…3).
//   GET  /api/forms/application            live version (any signed-in user; the apply page renders it)
//   GET  /api/forms/application?versions=1 + version history (Admin IT)
//   PUT  /api/forms/application { sections, fields, note }   publish a new version (Admin IT)
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session";
import { FORM_KEYS, type FormKey } from "@/lib/forms";
import { getForm, listVersions, normaliseForm, publishForm } from "@/lib/forms-server";
import { audit, type Diff } from "@/lib/audit";

const canConfigure = (role: string) => role === "admin_it"; // PRD §5: configure forms = Admin IT only

export async function GET(req: NextRequest, { params }: { params: { form: string } }) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!FORM_KEYS.includes(params.form as FormKey)) return NextResponse.json({ error: "Unknown form" }, { status: 404 });
  const form = await getForm(params.form as FormKey);
  const withVersions = req.nextUrl.searchParams.get("versions") === "1" && (canConfigure(user.role) || user.role === "ceo");
  return NextResponse.json({ form, ...(withVersions ? { versions: await listVersions(params.form as FormKey) } : {}) });
}

export async function PUT(req: NextRequest, { params }: { params: { form: string } }) {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canConfigure(user.role)) return NextResponse.json({ error: "Only Admin IT can change forms" }, { status: 403 });
  const key = params.form as FormKey;
  if (!FORM_KEYS.includes(key)) return NextResponse.json({ error: "Unknown form" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = normaliseForm(key, body);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  const def = result.def!;

  const current = await getForm(key);
  // Compare in normalised form, so re-sending the live form (or the built-in v0) is "no change"
  const currentNorm = normaliseForm(key, current).def ?? current;
  if (JSON.stringify(currentNorm) === JSON.stringify(def))
    return NextResponse.json({ error: "No changes to publish" }, { status: 400 });

  // Human-readable change list for the audit log
  const before: Record<string, Record<string, unknown>> = Object.fromEntries(current.fields.map((f) => [f.key, { ...f }]));
  const after: Record<string, Record<string, unknown>> = Object.fromEntries(def.fields.map((f) => [f.key, { ...f }]));
  const diff: Diff = {};
  for (const k of Object.keys(after)) {
    const f = after[k], old = before[k];
    if (!old) diff[k] = { from: null, to: `added ${f.type} field "${f.label}"${f.isPublic ? " (public)" : ""}` };
    else if (JSON.stringify(old) !== JSON.stringify(f)) {
      const changed = Object.keys({ ...old, ...f }).filter((p) => JSON.stringify(old[p]) !== JSON.stringify(f[p]));
      diff[k] = { from: Object.fromEntries(changed.map((p) => [p, old[p] ?? null])), to: Object.fromEntries(changed.map((p) => [p, f[p] ?? null])) };
    }
  }
  for (const k of Object.keys(before)) if (!after[k]) diff[k] = { from: `"${before[k].label}"`, to: "removed (existing answers are kept)" };

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  const version = await publishForm(key, def, note, user.name);
  revalidatePath("/", "layout"); // public fields (FORM-3) may have changed
  await audit(req, user, "form.publish", "form", key, `Published ${key} form v${version}${note ? `: ${note}` : ""}`, diff);
  return NextResponse.json({ success: true, form: await getForm(key) });
}
