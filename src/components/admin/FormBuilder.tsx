"use client";
// Form builder (PRD FORM-1…3): Admin IT edits the application and mentor forms, picks which
// fields are public, and publishes a new version. Built-in fields can be relabelled but not removed.
import { useCallback, useEffect, useMemo, useState } from "react";
import { FIELD_TYPES, FORM_KEYS, FORM_LABELS, isLocked, type FieldDef, type FormDef, type FormKey, type SectionDef } from "@/lib/forms";
import { useFlash } from "@/components/Toast";

type Version = { version: number; note: string | null; createdBy: string; createdAt: string; fieldCount: number };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
const input = "w-full bg-white border border-border rounded-lg px-3 py-2 text-sm font-body";
const typeLabel = (t: string) => FIELD_TYPES.find((x) => x.value === t)?.label ?? t;

export default function FormBuilder({ canEdit }: { canEdit: boolean }) {
  const [formKey, setFormKey] = useState<FormKey>("application");
  const [live, setLive] = useState<FormDef | null>(null);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { msg, flash } = useFlash(5000);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (key: FormKey) => {
    const d = await fetch(`/api/forms/${key}?versions=1`).then((r) => r.json());
    setLive(d.form); setSections(d.form.sections); setFields(d.form.fields); setVersions(d.versions ?? []);
    setOpen(null); setNote("");
  }, []);
  useEffect(() => { load(formKey); }, [formKey, load]);

  const dirty = useMemo(() => !!live && JSON.stringify({ s: live.sections, f: live.fields }) !== JSON.stringify({ s: sections, f: fields }), [live, sections, fields]);

  const update = (key: string, patch: Partial<FieldDef>) => setFields((p) => p.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  const move = (key: string, dir: -1 | 1) => setFields((p) => {
    const i = p.findIndex((f) => f.key === key);
    const sec = p[i].section;
    let j = i + dir;
    while (j >= 0 && j < p.length && p[j].section !== sec) j += dir;
    if (j < 0 || j >= p.length) return p;
    const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  function addField(section: string) {
    let base = "custom_field", n = 1;
    while (fields.some((f) => f.key === `${base}${n}`)) n++;
    const key = `${base}${n}`;
    setFields((p) => [...p, { key, label: "New question", type: "text", section, required: false, isPublic: false, maxLength: 200 }]);
    setOpen(key);
  }
  function addSection() {
    const title = window.prompt("Section title")?.trim();
    if (!title) return;
    if (sections.some((s) => s.title === title)) return flash("A section with that title exists", false);
    setSections((p) => [...p, { title }]);
  }
  function renameSection(old: string) {
    const title = window.prompt("New section title", old)?.trim();
    if (!title || title === old) return;
    if (sections.some((s) => s.title === title)) return flash("A section with that title exists", false);
    setSections((p) => p.map((s) => (s.title === old ? { ...s, title } : s)));
    setFields((p) => p.map((f) => (f.section === old ? { ...f, section: title } : f)));
  }

  async function publish() {
    setBusy(true);
    const res = await fetch(`/api/forms/${formKey}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections, fields, note }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash(`Published version ${d.form.version}. New submissions use it now.`);
    load(formKey);
  }

  if (!live) return <p className="text-sm text-muted font-body">Loading form…</p>;

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div role="tablist" className="inline-flex bg-white border border-border rounded-xl p-1">
            {FORM_KEYS.map((k) => (
              <button key={k} role="tab" aria-selected={formKey === k} onClick={() => { if (!dirty || window.confirm("Discard unpublished changes?")) setFormKey(k); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-body ${formKey === k ? "bg-brand text-white font-semibold" : "text-secondary hover:text-navy"}`}>{FORM_LABELS[k]}</button>
            ))}
          </div>
          <span className="text-xs font-mono text-muted">Live: v{live.version}{live.version === 0 ? " (built-in)" : ""}</span>
          {dirty && <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Unpublished changes</span>}
        </div>
        {msg && <p role="status" className={`mb-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
        {formKey === "mentor" && <p className="mb-4 text-xs font-body text-muted">Built-in mentor fields have a fixed layout in the Mentor hub; you can choose which are public and add your own questions.</p>}

        <div className="space-y-5">
          {sections.map((sec) => {
            const list = fields.filter((f) => f.section === sec.title);
            return (
              <section key={sec.title} className="bg-white border border-border rounded-2xl shadow-card">
                <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-body font-bold text-navy truncate">{sec.title}</h3>
                    {canEdit ? (
                      <input value={sec.desc ?? ""} onChange={(e) => setSections((p) => p.map((s) => (s.title === sec.title ? { ...s, desc: e.target.value } : s)))}
                        placeholder="Section description (optional)" aria-label={`Description of ${sec.title}`} className="w-full text-xs text-muted font-body bg-transparent focus:outline-none focus:bg-bg rounded px-1 -mx-1" />
                    ) : sec.desc && <p className="text-xs text-muted font-body">{sec.desc}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs font-body">
                      <button onClick={() => renameSection(sec.title)} className="text-secondary hover:text-navy">Rename</button>
                      {list.length === 0 && <button onClick={() => setSections((p) => p.filter((s) => s.title !== sec.title))} className="text-red-700">Remove</button>}
                    </div>
                  )}
                </header>
                <ul className="divide-y divide-border">
                  {list.map((f, i) => {
                    const expanded = open === f.key;
                    return (
                      <li key={f.key} className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-body font-semibold text-navy">{f.label}{f.required && <span className="text-red-600"> *</span>}</p>
                            <p className="text-[11px] font-mono text-muted">
                              {typeLabel(f.type)} · {f.core ? "built-in" : "custom"} · <span className="text-faint">{f.key}</span>
                            </p>
                          </div>
                          <label className={`flex items-center gap-1.5 text-xs font-body ${f.neverPublic ? "text-faint" : "text-secondary"}`} title={f.neverPublic ? "Personal contact data is never public" : isLocked(f, "isPublic") ? "Always public" : "Show on the public profile"}>
                            <input type="checkbox" checked={!!f.isPublic && !f.neverPublic} disabled={!canEdit || f.neverPublic || isLocked(f, "isPublic")}
                              onChange={(e) => update(f.key, { isPublic: e.target.checked })} className="w-4 h-4 accent-[#3F7A16]" /> Public
                          </label>
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => move(f.key, -1)} disabled={i === 0} aria-label={`Move ${f.label} up`} className="w-7 h-7 rounded border border-border text-xs disabled:opacity-30">↑</button>
                              <button onClick={() => move(f.key, 1)} disabled={i === list.length - 1} aria-label={`Move ${f.label} down`} className="w-7 h-7 rounded border border-border text-xs disabled:opacity-30">↓</button>
                              <button onClick={() => setOpen(expanded ? null : f.key)} aria-expanded={expanded} className="px-2 h-7 rounded border border-border text-xs font-body">{expanded ? "Done" : "Edit"}</button>
                            </div>
                          )}
                        </div>
                        {expanded && canEdit && (
                          <div className="mt-3 grid sm:grid-cols-2 gap-3 bg-surface-2 border border-border rounded-xl p-4">
                            <label className="block"><span className="block text-[11px] text-muted font-body mb-1">Label</span>
                              <input className={input} value={f.label} maxLength={120} onChange={(e) => update(f.key, { label: e.target.value })} /></label>
                            <label className="block"><span className="block text-[11px] text-muted font-body mb-1">Type</span>
                              <select className={input} value={f.type} disabled={f.core} onChange={(e) => update(f.key, { type: e.target.value as FieldDef["type"], options: ["select", "multiselect"].includes(e.target.value) ? f.options ?? ["Option 1", "Option 2"] : undefined })}>
                                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select></label>
                            {!f.core && (
                              <label className="block sm:col-span-2"><span className="block text-[11px] text-muted font-body mb-1">Key (stored answer name)</span>
                                <input className={`${input} font-mono`} value={f.key} onChange={(e) => {
                                  const k = slug(e.target.value) || f.key;
                                  if (k !== f.key && /^[a-z]/.test(k) && !fields.some((x) => x.key === k)) { setFields((p) => p.map((x) => (x.key === f.key ? { ...x, key: k } : x))); setOpen(k); }
                                }} />
                                <span className="text-[10px] text-faint font-body">Change this only before the first publish; answers are stored under it.</span></label>
                            )}
                            <label className="block sm:col-span-2"><span className="block text-[11px] text-muted font-body mb-1">Help text</span>
                              <input className={input} value={f.help ?? ""} maxLength={300} onChange={(e) => update(f.key, { help: e.target.value })} /></label>
                            <label className="block"><span className="block text-[11px] text-muted font-body mb-1">Placeholder</span>
                              <input className={input} value={f.placeholder ?? ""} maxLength={160} onChange={(e) => update(f.key, { placeholder: e.target.value })} /></label>
                            {["text", "textarea", "url", "tel", "email"].includes(f.type) && (
                              <label className="block"><span className="block text-[11px] text-muted font-body mb-1">Character limit</span>
                                <input className={input} type="number" min={1} max={5000} value={f.maxLength ?? ""} onChange={(e) => update(f.key, { maxLength: e.target.value ? Number(e.target.value) : undefined })} /></label>
                            )}
                            {(f.type === "select" || f.type === "multiselect") && (
                              <label className="block sm:col-span-2"><span className="block text-[11px] text-muted font-body mb-1">Options (one per line){isLocked(f, "options") && " — fixed: other features depend on this list"}</span>
                                <textarea className={`${input} resize-y`} rows={4} disabled={isLocked(f, "options")} value={(f.options ?? []).join("\n")}
                                  onChange={(e) => update(f.key, { options: e.target.value.split("\n") })} /></label>
                            )}
                            <label className="flex items-center gap-2 text-sm font-body text-secondary">
                              <input type="checkbox" checked={!!f.required} disabled={isLocked(f, "required")} onChange={(e) => update(f.key, { required: e.target.checked })} className="w-4 h-4 accent-[#3F7A16]" /> Required
                            </label>
                            {!f.core && (
                              <button onClick={() => { if (window.confirm(`Remove "${f.label}"? Answers already given are kept but no longer shown on the form.`)) setFields((p) => p.filter((x) => x.key !== f.key)); }}
                                className="justify-self-end text-xs font-body text-red-700 hover:underline">Remove field</button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {canEdit && (
                  <div className="px-5 py-3 border-t border-border">
                    <button onClick={() => addField(sec.title)} className="text-sm font-body font-semibold text-brand hover:underline">+ Add question</button>
                  </div>
                )}
              </section>
            );
          })}
          {canEdit && <button onClick={addSection} className="w-full py-3 border-2 border-dashed border-border rounded-2xl text-sm font-body text-secondary hover:border-brand hover:text-brand">+ Add section</button>}
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20">
        {canEdit && (
          <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
            <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Publish</p>
            <label className="block"><span className="block text-[11px] text-muted font-body mb-1">What changed? (kept in history)</span>
              <input className={input} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added women-led startup question" /></label>
            <button onClick={publish} disabled={!dirty || busy} className="mt-3 w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-40">
              {busy ? "Publishing…" : `Publish as v${(versions[0]?.version ?? 0) + 1}`}
            </button>
            {dirty && <button onClick={() => load(formKey)} className="mt-2 w-full py-2 text-xs font-body text-secondary hover:text-navy">Discard changes</button>}
            <p className="text-[11px] text-muted font-body mt-3">Applications already submitted keep their answers. Removed questions are hidden, not deleted.</p>
          </div>
        )}
        <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
          <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Version history</p>
          {versions.length === 0 ? <p className="text-sm text-muted font-body">Using the built-in form (v0). Nothing published yet.</p> : (
            <ol className="space-y-3">
              {versions.map((v) => (
                <li key={v.version} className="text-sm font-body">
                  <p className="font-semibold text-navy">v{v.version} <span className="font-normal text-muted text-xs">· {v.fieldCount} fields</span></p>
                  {v.note && <p className="text-xs text-secondary">{v.note}</p>}
                  <p className="text-[11px] font-mono text-muted">{v.createdBy} · {new Date(v.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
