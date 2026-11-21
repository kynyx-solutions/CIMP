"use client";
// CRM (BIIF 2.0): partner pipeline by stage, activity log, follow-ups and MoU expiry.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ACTIVITY_KINDS, PARTNER_STAGES, PARTNER_TYPES, canUseCrm, stageLabel, typeLabel } from "@/lib/crm";
import { inr } from "@/lib/finance";

type Activity = { _id: string; kind: string; summary: string; dueAt: string | null; done: boolean; byName: string; createdAt: string };
type Partner = { _id: string; name: string; type: string; stage: string; ownerName: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  website: string | null; expectedValueInr: number | null; notes: string | null; mouSignedOn: string | null; mouExpiresOn: string | null; activities: Activity[] };
type Data = { partners: Partner[]; followUpsDue: (Activity & { partnerName: string })[]; mouExpiring: { _id: string; name: string; mouExpiresOn: string }[] };

const input = "w-full bg-bg border border-border rounded-xl px-3 py-2 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";
const d10 = (s: string | null) => (s ? s.slice(0, 10) : "");
const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const EMPTY = { name: "", type: "corporate", stage: "lead", contactName: "", contactEmail: "", contactPhone: "", website: "", expectedValueInr: "", notes: "", mouSignedOn: "", mouExpiresOn: "" };

export default function CrmPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [d, setD] = useState<Data | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [act, setAct] = useState({ activity: "note", summary: "", dueAt: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((x) => { if (!x.user || !canUseCrm(x.user.role)) { router.push("/dashboard"); return; } setUser(x.user); }); }, [router]);
  const load = useCallback(async () => { setD(await fetch("/api/partners").then((r) => r.json())); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };
  async function call(method: string, body: object, ok: string) {
    setBusy(true);
    const res = await fetch("/api/partners", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const x = await res.json(); setBusy(false);
    if (!res.ok) { flash(x.error, false); return null; }
    flash(ok); await load(); return x;
  }

  if (!user || !d) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  const p = d.partners.find((x) => x._id === sel) ?? null;
  const pipelineValue = d.partners.filter((x) => ["proposal", "mou_signed", "active"].includes(x.stage)).reduce((n, x) => n + (x.expectedValueInr ?? 0), 0);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-navy">Partners</h1>
          <span className="text-sm font-mono text-muted">{d.partners.length} partners · pipeline {inr(pipelineValue)}</span>
          <button onClick={() => { setForm({ ...EMPTY }); setSel(null); }} className="ml-auto px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body">+ Add partner</button>
        </div>
        <p className="text-secondary font-body text-sm mt-1">Corporate, CSR, government and academic relationships: where each stands, what was said, and what is due next.</p>

        {(d.followUpsDue.length > 0 || d.mouExpiring.length > 0) && (
          <div className="mt-5 grid md:grid-cols-2 gap-4">
            {d.followUpsDue.length > 0 && (
              <div className="bg-white border border-amber-300 rounded-2xl p-4 shadow-card">
                <p className="text-[11px] font-mono text-amber-800 uppercase tracking-wider">Follow-ups due</p>
                <ul className="mt-2 space-y-1.5 text-sm font-body">
                  {d.followUpsDue.map((a) => <li key={a._id} className="flex gap-2"><button onClick={() => call("PATCH", { activityId: a._id, done: true }, "Marked done.")} aria-label="Mark done" className="w-4 h-4 mt-0.5 border border-border rounded flex-shrink-0" /><span><strong className="text-navy">{a.partnerName}</strong> · {a.summary} <span className="text-xs text-muted">({date(a.dueAt!)})</span></span></li>)}
                </ul>
              </div>
            )}
            {d.mouExpiring.length > 0 && (
              <div className="bg-white border border-amber-300 rounded-2xl p-4 shadow-card">
                <p className="text-[11px] font-mono text-amber-800 uppercase tracking-wider">MoUs expiring within 30 days</p>
                <ul className="mt-2 space-y-1 text-sm font-body">{d.mouExpiring.map((m) => <li key={m._id}><button onClick={() => setSel(m._id)} className="text-navy font-semibold hover:text-brand">{m.name}</button> · {date(m.mouExpiresOn)}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {/* Pipeline board */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {PARTNER_STAGES.map((st) => {
            const list = d.partners.filter((x) => x.stage === st.value);
            return (
              <section key={st.value} className="bg-surface-2 border border-border rounded-2xl p-3 min-h-[120px]">
                <h2 className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">{st.label} <span className="text-faint">({list.length})</span></h2>
                <ul className="space-y-2">
                  {list.map((x) => (
                    <li key={x._id}>
                      <button onClick={() => { setSel(x._id); setForm(null); }} className={`w-full text-left bg-white border rounded-xl p-3 shadow-card ${sel === x._id ? "border-brand" : "border-border hover:border-brand"}`}>
                        <span className="block text-sm font-body font-semibold text-navy">{x.name}</span>
                        <span className="block text-[11px] font-mono text-muted">{typeLabel(x.type)}{x.expectedValueInr ? ` · ${inr(x.expectedValueInr)}` : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {form && (
          <form className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
            onSubmit={async (e) => { e.preventDefault(); const r = form.id ? await call("PUT", { partnerId: form.id, ...form }, "Partner updated.") : await call("POST", { kind: "partner", ...form }, "Partner added."); if (r) { setSel(r.partner._id); setForm(null); } }}>
            <h2 className="sm:col-span-2 lg:col-span-3 font-body font-bold text-navy">{form.id ? "Edit partner" : "New partner"}</h2>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Name</span><input required value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Type</span><select value={form.type} onChange={(e) => setForm((f) => f && { ...f, type: e.target.value })} className={input}>{PARTNER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Stage</span><select value={form.stage} onChange={(e) => setForm((f) => f && { ...f, stage: e.target.value })} className={input}>{PARTNER_STAGES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Contact person</span><input value={form.contactName} onChange={(e) => setForm((f) => f && { ...f, contactName: e.target.value })} className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Contact email</span><input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => f && { ...f, contactEmail: e.target.value })} className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Contact phone</span><input value={form.contactPhone} onChange={(e) => setForm((f) => f && { ...f, contactPhone: e.target.value })} className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Website</span><input type="url" value={form.website} onChange={(e) => setForm((f) => f && { ...f, website: e.target.value })} placeholder="https://" className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Expected value (₹)</span><input type="number" min={0} value={form.expectedValueInr} onChange={(e) => setForm((f) => f && { ...f, expectedValueInr: e.target.value })} className={input} /></label>
            <span />
            <label className="block"><span className="block text-xs text-muted font-body mb-1">MoU signed on</span><input type="date" value={form.mouSignedOn} onChange={(e) => setForm((f) => f && { ...f, mouSignedOn: e.target.value })} className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">MoU expires on</span><input type="date" value={form.mouExpiresOn} onChange={(e) => setForm((f) => f && { ...f, mouExpiresOn: e.target.value })} className={input} /></label>
            <label className="block sm:col-span-2 lg:col-span-3"><span className="block text-xs text-muted font-body mb-1">Notes</span><textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })} className={`${input} resize-none`} /></label>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3"><button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl border border-border text-sm font-body">Cancel</button><button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Save</button></div>
          </form>
        )}

        {p && !form && (
          <section className="mt-6 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
            <div className="bg-white border border-border rounded-2xl shadow-card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-navy">{p.name}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border bg-leaf-50 text-leaf-800 border-leaf-200">{stageLabel(p.stage)}</span>
                <button onClick={() => setForm({ id: p._id, name: p.name, type: p.type, stage: p.stage, contactName: p.contactName ?? "", contactEmail: p.contactEmail ?? "", contactPhone: p.contactPhone ?? "", website: p.website ?? "", expectedValueInr: p.expectedValueInr == null ? "" : String(p.expectedValueInr), notes: p.notes ?? "", mouSignedOn: d10(p.mouSignedOn), mouExpiresOn: d10(p.mouExpiresOn) })} className="ml-auto text-sm font-body font-semibold text-brand hover:underline">Edit</button>
              </div>
              <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm font-body">
                <div><dt className="text-[11px] font-mono text-muted uppercase">Type</dt><dd className="text-navy">{typeLabel(p.type)}</dd></div>
                <div><dt className="text-[11px] font-mono text-muted uppercase">Owner</dt><dd className="text-navy">{p.ownerName ?? "—"}</dd></div>
                <div><dt className="text-[11px] font-mono text-muted uppercase">Contact</dt><dd className="text-navy">{[p.contactName, p.contactEmail, p.contactPhone].filter(Boolean).join(" · ") || "—"}</dd></div>
                <div><dt className="text-[11px] font-mono text-muted uppercase">Expected value</dt><dd className="text-navy">{p.expectedValueInr ? inr(p.expectedValueInr) : "—"}</dd></div>
                <div><dt className="text-[11px] font-mono text-muted uppercase">MoU</dt><dd className="text-navy">{p.mouSignedOn ? `${date(p.mouSignedOn)} → ${p.mouExpiresOn ? date(p.mouExpiresOn) : "open-ended"}` : "Not signed"}</dd></div>
                {p.website && <div><dt className="text-[11px] font-mono text-muted uppercase">Website</dt><dd><a href={p.website} target="_blank" rel="noopener noreferrer" className="text-brand underline break-all">{p.website}</a></dd></div>}
              </dl>
              {p.notes && <p className="mt-4 text-sm font-body text-secondary whitespace-pre-line">{p.notes}</p>}
              <h3 className="mt-6 font-body font-bold text-navy text-sm">Activity</h3>
              <ol className="mt-2 border-l-2 border-border pl-4 space-y-2">
                {p.activities.length === 0 && <li className="text-sm text-muted font-body">No activity yet.</li>}
                {p.activities.map((a) => (
                  <li key={a._id} className={`text-sm font-body ${a.done ? "opacity-60" : ""}`}>
                    <span className="text-[11px] font-mono text-muted">{ACTIVITY_KINDS.find((k) => k.value === a.kind)?.label} · {a.byName} · {date(a.createdAt)}{a.dueAt ? ` · due ${date(a.dueAt)}` : ""}</span>
                    <p className="text-navy whitespace-pre-line">{a.summary}</p>
                    {a.kind === "follow_up" && <button onClick={() => call("PATCH", { activityId: a._id, done: !a.done }, a.done ? "Reopened." : "Marked done.")} className="text-xs text-brand font-semibold">{a.done ? "Reopen" : "Mark done"}</button>}
                  </li>
                ))}
              </ol>
            </div>
            <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3"
              onSubmit={async (e) => { e.preventDefault(); if (await call("POST", { kind: "activity", partnerId: p._id, ...act }, "Logged.")) setAct({ activity: "note", summary: "", dueAt: "" }); }}>
              <h3 className="font-body font-bold text-navy text-sm">Log activity</h3>
              <select value={act.activity} onChange={(e) => setAct((a) => ({ ...a, activity: e.target.value }))} aria-label="Activity type" className={input}>{ACTIVITY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
              <textarea required rows={3} value={act.summary} onChange={(e) => setAct((a) => ({ ...a, summary: e.target.value }))} placeholder="What was discussed, or what to do next" aria-label="Summary" className={`${input} resize-none`} />
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Due date {act.activity === "follow_up" ? "(required)" : "(optional)"}</span><input type="date" value={act.dueAt} onChange={(e) => setAct((a) => ({ ...a, dueAt: e.target.value }))} className={input} /></label>
              <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Save</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
