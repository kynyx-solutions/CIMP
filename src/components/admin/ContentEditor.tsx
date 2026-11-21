"use client";
// Website content editor (PRD WEB-6). Each block is edited as a form generated from the shape
// of its default value: text, yes/no, lists of items, nested groups.
import { useCallback, useEffect, useState } from "react";

type Item = {
  key: string; label: string; desc: string; where: string;
  value: unknown; default: unknown; customised: boolean; updatedBy: string | null; updatedAt: string | null;
};

const input = "w-full bg-white border border-border rounded-lg px-3 py-2 text-sm font-body";
const human = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** An empty value with the same shape as `template` (for "add item"). */
function blank(template: unknown): unknown {
  if (typeof template === "string") return "";
  if (typeof template === "number") return 0;
  if (typeof template === "boolean") return false;
  if (Array.isArray(template)) return [];
  if (template && typeof template === "object") return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, blank(v)]));
  return null;
}

function ShapeEditor({ template, value, onChange, label, disabled }: {
  template: unknown; value: unknown; onChange: (v: unknown) => void; label: string; disabled: boolean;
}) {
  if (typeof template === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm font-body text-navy">
        <input type="checkbox" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[#3F7A16]" /> {label}
      </label>
    );
  }
  if (typeof template === "string") {
    const long = template.length > 70 || String(value ?? "").length > 70;
    return (
      <label className="block">
        <span className="block text-[11px] text-muted font-body mb-1">{label}</span>
        {long
          ? <textarea className={`${input} resize-y`} rows={3} disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
          : <input className={input} disabled={disabled} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />}
      </label>
    );
  }
  if (typeof template === "number") {
    return (
      <label className="block"><span className="block text-[11px] text-muted font-body mb-1">{label}</span>
        <input type="number" className={input} disabled={disabled} value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} /></label>
    );
  }
  if (Array.isArray(template)) {
    const list = Array.isArray(value) ? value : [];
    const itemTpl = template[0] ?? "";
    const set = (i: number, v: unknown) => onChange(list.map((x, j) => (j === i ? v : x)));
    const swap = (i: number, j: number) => { const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
    return (
      <fieldset className="space-y-2">
        <legend className="text-[11px] font-mono text-muted uppercase tracking-wider mb-1">{label} ({list.length})</legend>
        {list.map((item, i) => (
          <div key={i} className={`flex gap-2 items-start ${typeof itemTpl === "object" ? "border border-border rounded-xl p-3 bg-surface-2" : ""}`}>
            <div className="flex-1 min-w-0">
              <ShapeEditor template={itemTpl} value={item} onChange={(v) => set(i, v)} label={typeof itemTpl === "object" ? `Item ${i + 1}` : `${i + 1}`} disabled={disabled} />
            </div>
            {!disabled && (
              <div className="flex flex-col gap-1 flex-shrink-0 pt-5">
                <button type="button" onClick={() => swap(i, i - 1)} disabled={i === 0} aria-label="Move up" className="w-7 h-7 rounded border border-border text-xs bg-white disabled:opacity-30">↑</button>
                <button type="button" onClick={() => swap(i, i + 1)} disabled={i === list.length - 1} aria-label="Move down" className="w-7 h-7 rounded border border-border text-xs bg-white disabled:opacity-30">↓</button>
                <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove" className="w-7 h-7 rounded border border-red-200 text-red-700 text-xs bg-white">✕</button>
              </div>
            )}
          </div>
        ))}
        {!disabled && <button type="button" onClick={() => onChange([...list, blank(itemTpl)])} className="text-sm font-body font-semibold text-brand hover:underline">+ Add</button>}
      </fieldset>
    );
  }
  if (template && typeof template === "object") {
    const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.entries(template as Record<string, unknown>).map(([k, t]) => (
          <div key={k} className={Array.isArray(t) || (typeof t === "string" && t.length > 70) ? "sm:col-span-2" : ""}>
            <ShapeEditor template={t} value={obj[k]} onChange={(v) => onChange({ ...obj, [k]: v })} label={human(k)} disabled={disabled} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function ContentEditor() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [active, setActive] = useState<string>("sampleMode");
  const [draft, setDraft] = useState<unknown>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (keep?: string) => {
    const d = await fetch("/api/admin/content").then((r) => r.json());
    setItems(d.items); setCanEdit(d.canEdit);
    const cur = d.items.find((i: Item) => i.key === (keep ?? active)) ?? d.items[0];
    setActive(cur.key); setDraft(cur.value);
  }, [active]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const item = items?.find((i) => i.key === active);
  const dirty = !!item && JSON.stringify(item.value) !== JSON.stringify(draft);
  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  async function save() {
    setBusy(true);
    const res = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: active, value: draft }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash("Saved. The public site shows the change now."); load(active);
  }
  async function reset() {
    if (!window.confirm("Restore the default content for this block?")) return;
    const res = await fetch(`/api/admin/content?key=${active}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) return flash(d.error, false);
    flash("Default restored."); load(active);
  }

  if (!items || !item) return <p className="text-sm text-muted font-body">Loading content…</p>;

  return (
    <div className="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
      <nav aria-label="Content blocks" className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        {items.map((i) => (
          <button key={i.key} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) { setActive(i.key); setDraft(i.value); } }}
            aria-current={active === i.key}
            className={`w-full text-left px-4 py-3 border-b border-border last:border-0 ${active === i.key ? "bg-leaf-50 border-l-2 border-l-brand" : "hover:bg-bg"}`}>
            <span className="block text-sm font-body font-semibold text-navy">{i.label}</span>
            <span className="block text-[11px] font-mono text-muted">{i.customised ? `Edited · ${i.updatedBy}` : "Default"}</span>
          </button>
        ))}
      </nav>
      <section className="bg-white border border-border rounded-2xl shadow-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h3 className="font-display text-xl font-bold text-navy">{item.label}</h3>
            <p className="text-sm text-secondary font-body">{item.desc}</p>
            <p className="text-[11px] font-mono text-muted mt-1">Appears on: {item.where}</p>
          </div>
          {item.customised && item.updatedAt && (
            <p className="text-[11px] font-mono text-muted">Last edit {new Date(item.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          )}
        </div>
        {msg && <p role="status" className={`mb-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
        {!canEdit && <p className="mb-4 text-xs font-body text-muted">View only. Website content is edited by Admin IT.</p>}
        <ShapeEditor template={item.default} value={draft} onChange={setDraft} label={item.key === "sampleMode" ? "Show sample banner and tags" : item.label} disabled={!canEdit} />
        {canEdit && (
          <div className="mt-6 pt-5 border-t border-border flex flex-wrap gap-3">
            <button onClick={save} disabled={!dirty || busy} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-40">{busy ? "Saving…" : "Save & publish"}</button>
            {dirty && <button onClick={() => setDraft(item.value)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-body text-secondary">Discard</button>}
            {item.customised && <button onClick={reset} className="ml-auto text-sm font-body text-muted hover:text-red-700">Restore default</button>}
          </div>
        )}
      </section>
    </div>
  );
}
