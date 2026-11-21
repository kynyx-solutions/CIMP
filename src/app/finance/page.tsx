"use client";
// Accounts and finance approvals (BIIF 2.0): requests, approval queue, seed-fund register.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { isOfficeRole, ROLE_LABELS } from "@/lib/workflow";
import { FINANCE_KINDS, FIN_STATUS, canActFinance, inr, kindLabel, type FinAction } from "@/lib/finance";

type Step = { id: string; action: string; actorName: string; actorRole: string; remark: string | null; at: string };
type Req = { _id: string; kind: string; title: string; description: string; amountInr: number; payee: string; status: string; requestedBy: string; mine: boolean;
  hasInvoice: boolean; invoiceName: string | null; paymentRef: string | null; createdAt: string; application: { startupName: string } | null; steps: Step[]; applicationId: string | null };
type Fund = { _id: string; applicationId: string; scheme: string; sanctionedInr: number; sanctionedOn: string; application: { startupName: string }; disbursed: number; inFlight: number };
type Data = { role: string; viewer: boolean; ceoLimit: number; requests: Req[]; register: Fund[]; startups: { _id: string; startupName: string }[] };

const TONE = { warn: "bg-amber-50 text-amber-800 border-amber-200", good: "bg-leaf-50 text-leaf-800 border-leaf-200", bad: "bg-red-50 text-red-700 border-red-200", muted: "bg-slate-50 text-slate-600 border-slate-200" };
const input = "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";
const EMPTY = { kind: "disbursement", title: "", description: "", amountInr: "", payee: "", applicationId: "" };
const ACTIONS: { a: FinAction; label: string; cls: string }[] = [
  { a: "verify", label: "Verify", cls: "bg-brand text-white" }, { a: "approve", label: "Approve", cls: "bg-brand text-white" },
  { a: "final_approve", label: "CEO approve", cls: "bg-brand text-white" }, { a: "pay", label: "Record payment", cls: "bg-brand text-white" },
  { a: "send_back", label: "Send back", cls: "border border-border text-secondary" }, { a: "reject", label: "Reject", cls: "border border-red-200 text-red-700" },
];

export default function FinancePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [d, setD] = useState<Data | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "requests" | "seed">("queue");
  const [fund, setFund] = useState({ applicationId: "", scheme: "Bihar Startup Policy seed fund", sanctionedInr: "", sanctionedOn: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((x) => { if (!x.user || !isOfficeRole(x.user.role)) { router.push("/dashboard"); return; } setUser(x.user); }); }, [router]);
  const load = useCallback(async () => { const x = await fetch("/api/finance").then((r) => r.json()); setD(x); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };

  async function call(method: string, url: string, body: object, okText: string) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const x = await res.json(); setBusy(false);
    if (!res.ok) { flash(x.error, false); return false; }
    flash(okText); await load(); return true;
  }
  async function act(r: Req, a: FinAction) {
    let remark = "", paymentRef = "";
    if (a === "pay") { paymentRef = window.prompt("Payment reference (UTR / cheque number):")?.trim() ?? ""; if (!paymentRef) return; }
    if (a === "reject" || a === "send_back") { remark = window.prompt(a === "reject" ? "Reason for rejecting:" : "What should the requester change?")?.trim() ?? ""; if (!remark) return; }
    if (a === "verify" || a === "approve" || a === "final_approve") remark = window.prompt("Remark (optional):") ?? "";
    await call("PATCH", "/api/finance", { requestId: r._id, action: a, remark, paymentRef }, "Done.");
  }
  async function upload(file: File) {
    if (!uploadFor.current) return;
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`/api/finance/${uploadFor.current}/invoice`, { method: "POST", body: fd });
    const x = await res.json(); setBusy(false);
    if (!res.ok) flash(x.error, false); else { flash("Invoice attached."); load(); }
  }

  if (!user || !d) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  const queue = d.requests.filter((r) => !r.mine && ACTIONS.some((x) => canActFinance(d.role, r.status, x.a, r.amountInr) && !["send_back", "reject"].includes(x.a)));
  const tabs = [{ k: "queue", l: `Waiting on me (${queue.length})` }, { k: "requests", l: d.viewer ? "All requests" : "My requests" }, ...(d.viewer ? [{ k: "seed", l: "Seed-fund register" }] : [])] as const;

  const Row = ({ r }: { r: Req }) => {
    const s = FIN_STATUS[r.status];
    const acts = r.mine ? [] : ACTIONS.filter((x) => canActFinance(d.role, r.status, x.a, r.amountInr));
    const expanded = open === r._id;
    return (
      <li className="bg-white border border-border rounded-2xl p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setOpen(expanded ? null : r._id)} className="text-left font-body font-bold text-navy hover:text-brand flex-1 min-w-0">{r.title}</button>
          <span className="font-mono text-sm text-navy tabular-nums">{inr(r.amountInr)}</span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${TONE[s?.tone ?? "muted"]}`}>{s?.label ?? r.status}</span>
        </div>
        <p className="text-xs font-mono text-muted mt-0.5">{kindLabel(r.kind)}{r.application ? ` · ${r.application.startupName}` : ""} · to {r.payee} · by {r.requestedBy} · {new Date(r.createdAt).toLocaleDateString("en-IN")}{r.amountInr > d.ceoLimit ? " · needs CEO" : ""}</p>
        {expanded && (
          <div className="mt-3 text-sm font-body">
            <p className="text-secondary whitespace-pre-line">{r.description}</p>
            {r.hasInvoice && <a href={`/api/finance/${r._id}/invoice`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs text-brand underline">📎 {r.invoiceName}</a>}
            {r.paymentRef && <p className="text-xs text-leaf-800 mt-2">Payment reference: {r.paymentRef}</p>}
            <ol className="mt-3 border-l-2 border-border pl-4 space-y-1.5">
              {r.steps.map((st) => <li key={st.id} className="text-xs text-secondary"><span className="font-semibold text-navy">{st.actorName}</span> ({ROLE_LABELS[st.actorRole] ?? st.actorRole}) {st.action} <span className="font-mono text-muted">· {new Date(st.at).toLocaleDateString("en-IN")}</span>{st.remark && <span className="block italic text-muted">“{st.remark}”</span>}</li>)}
            </ol>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {acts.map((x) => <button key={x.a} disabled={busy} onClick={() => act(r, x.a)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-body disabled:opacity-50 ${x.cls}`}>{x.label}</button>)}
          {r.mine && ["submitted", "returned"].includes(r.status) && <button disabled={busy} onClick={() => { uploadFor.current = r._id; fileRef.current?.click(); }} className="px-3 py-1.5 rounded-lg text-xs font-body border border-border text-navy">{r.hasInvoice ? "Replace invoice" : "Attach invoice"}</button>}
          {r.mine && r.status === "returned" && <button onClick={() => { setEditing(r._id); setForm({ kind: r.kind, title: r.title, description: r.description, amountInr: String(r.amountInr), payee: r.payee, applicationId: r.applicationId ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold font-body text-brand">Edit &amp; resubmit</button>}
        </div>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" aria-label="Attach invoice" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-navy">Finance</h1>
          {!form && <button onClick={() => { setEditing(null); setForm(EMPTY); }} className="ml-auto px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body">+ New request</button>}
        </div>
        <p className="text-secondary font-body text-sm mt-1">Payments go through Accounts verification and Senior Manager approval; above {inr(d.ceoLimit)} the CEO approves too. Every step is in the audit log.</p>

        {form && (
          <form className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6 grid sm:grid-cols-2 gap-4"
            onSubmit={async (e) => { e.preventDefault(); const ok = editing ? await call("PUT", "/api/finance", { requestId: editing, ...form }, "Resubmitted.") : await call("POST", "/api/finance", form, "Request raised. Accounts will verify it."); if (ok) { setForm(null); setEditing(null); } }}>
            <label className="block sm:col-span-2"><span className="block text-xs text-muted font-body mb-1">Type</span>
              <select value={form.kind} onChange={(e) => setForm((p) => p && { ...p, kind: e.target.value })} className={input}>{FINANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
            {form.kind === "grant_tranche" && (
              <label className="block sm:col-span-2"><span className="block text-xs text-muted font-body mb-1">Startup</span>
                <select required value={form.applicationId} onChange={(e) => setForm((p) => p && { ...p, applicationId: e.target.value })} className={input}>
                  <option value="">Choose…</option>{d.startups.map((s) => <option key={s._id} value={s._id}>{s.startupName}</option>)}
                </select></label>
            )}
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Title</span><input required maxLength={140} value={form.title} onChange={(e) => setForm((p) => p && { ...p, title: e.target.value })} className={input} /></label>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Amount (₹)</span><input required type="number" min={1} value={form.amountInr} onChange={(e) => setForm((p) => p && { ...p, amountInr: e.target.value })} className={input} /></label>
            <label className="block sm:col-span-2"><span className="block text-xs text-muted font-body mb-1">Payee</span><input required maxLength={140} value={form.payee} onChange={(e) => setForm((p) => p && { ...p, payee: e.target.value })} placeholder="Vendor, startup or staff member" className={input} /></label>
            <label className="block sm:col-span-2"><span className="block text-xs text-muted font-body mb-1">What is it for?</span><textarea required rows={3} maxLength={3000} value={form.description} onChange={(e) => setForm((p) => p && { ...p, description: e.target.value })} className={`${input} resize-none`} /></label>
            <div className="sm:col-span-2 flex gap-3">
              <button type="button" onClick={() => { setForm(null); setEditing(null); }} className="px-4 py-2.5 rounded-xl border border-border text-sm font-body">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">{editing ? "Resubmit" : "Raise request"}</button>
              <span className="text-xs text-muted font-body self-center">Attach the invoice after raising the request.</span>
            </div>
          </form>
        )}

        <div role="tablist" className="mt-6 mb-4 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((t) => <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k as "queue" | "requests" | "seed")} className={`px-4 py-2.5 text-sm font-body font-semibold -mb-px border-b-2 ${tab === t.k ? "border-brand text-brand" : "border-transparent text-muted hover:text-navy"}`}>{t.l}</button>)}
        </div>

        {tab === "queue" && (queue.length ? <ul className="space-y-3">{queue.map((r) => <Row key={r._id} r={r} />)}</ul> : <p className="bg-white border border-border rounded-2xl p-8 text-center text-muted font-body text-sm">Nothing is waiting on you.</p>)}
        {tab === "requests" && (d.requests.length ? <ul className="space-y-3">{d.requests.map((r) => <Row key={r._id} r={r} />)}</ul> : <p className="bg-white border border-border rounded-2xl p-8 text-center text-muted font-body text-sm">No requests yet.</p>)}
        {tab === "seed" && d.viewer && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div className="bg-white border border-border rounded-2xl shadow-card overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead className="bg-surface-2 text-left text-[11px] font-mono text-muted uppercase"><tr><th className="px-4 py-3">Startup</th><th className="px-4 py-3">Scheme</th><th className="px-4 py-3 text-right">Sanctioned</th><th className="px-4 py-3 text-right">Released</th><th className="px-4 py-3 text-right">In approval</th><th className="px-4 py-3">Progress</th></tr></thead>
                <tbody>
                  {d.register.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No sanctions recorded.</td></tr>}
                  {d.register.map((f) => {
                    const pct = Math.min(100, Math.round((f.disbursed / f.sanctionedInr) * 100));
                    return (
                      <tr key={f._id} className="border-t border-border">
                        <td className="px-4 py-3 font-semibold text-navy">{f.application.startupName}</td>
                        <td className="px-4 py-3 text-secondary">{f.scheme}<span className="block text-xs text-muted">{new Date(f.sanctionedOn).toLocaleDateString("en-IN")}</span></td>
                        <td className="px-4 py-3 text-right tabular-nums">{inr(f.sanctionedInr)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-leaf-800">{inr(f.disbursed)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-800">{inr(f.inFlight)}</td>
                        <td className="px-4 py-3 w-40" title={`${pct}% released`}><span className="block h-2 bg-slate-100 rounded-full overflow-hidden"><span className="block h-full bg-brand" style={{ width: `${pct}%` }} /></span><span className="text-[10px] font-mono text-muted">{pct}% released</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3" onSubmit={async (e) => { e.preventDefault(); await call("PUT", "/api/finance/seed-fund", fund, "Sanction saved; the startup has been notified."); }}>
              <h2 className="font-body font-bold text-navy text-sm">Record a sanction</h2>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Startup</span>
                <select required value={fund.applicationId} onChange={(e) => setFund((p) => ({ ...p, applicationId: e.target.value }))} className={input}><option value="">Choose…</option>{d.startups.map((s) => <option key={s._id} value={s._id}>{s.startupName}</option>)}</select></label>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Scheme</span><input required value={fund.scheme} onChange={(e) => setFund((p) => ({ ...p, scheme: e.target.value }))} className={input} /></label>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Sanctioned (₹)</span><input required type="number" min={1000} value={fund.sanctionedInr} onChange={(e) => setFund((p) => ({ ...p, sanctionedInr: e.target.value }))} className={input} /></label>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Sanction date</span><input required type="date" value={fund.sanctionedOn} onChange={(e) => setFund((p) => ({ ...p, sanctionedOn: e.target.value }))} className={input} /></label>
              <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Save</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
