"use client";
// Investment proposals and portfolio (PRD INV-1). Investor, office and founder views.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { INSTRUMENTS, PROPOSAL_STATUS } from "@/lib/invest";
import { periodLabel } from "@/lib/qpr";

const TONE = { warn: "bg-amber-50 text-amber-800 border-amber-200", good: "bg-leaf-50 text-leaf-800 border-leaf-200", bad: "bg-red-50 text-red-700 border-red-200", muted: "bg-slate-50 text-slate-600 border-slate-200" };
const Chip = ({ s }: { s: string }) => { const d = PROPOSAL_STATUS[s]; return <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${TONE[d?.tone ?? "muted"]}`}>{d?.label ?? s}</span>; };
const when = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const instrument = (v: string) => INSTRUMENTS.find((i) => i.value === v)?.label ?? v;
const input = "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";

export default function InvestPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (!d.user) { router.push("/login"); return; } setUser(d.user); }); }, [router]);
  const load = useCallback(async () => {
    const res = await fetch("/api/proposals"); const d = await res.json();
    if (!res.ok) setError(d.error); else setData(d);
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };
  async function call(method: string, body: object, okText: string) {
    setBusy(true);
    const res = await fetch("/api/proposals", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { flash(d.error, false); return false; }
    flash(okText); await load(); return true;
  }

  if (!user || (!data && !error)) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">{data?.role === "investor" ? "Invest" : "Investment proposals"}</h1>
        {error && <p className="mt-6 bg-white border border-border rounded-2xl p-8 text-center text-secondary font-body">{error}. <Link href="/mentor" className="text-brand underline">Mentor hub</Link></p>}
        {data?.role === "investor" && <Investor data={data} busy={busy} call={call} />}
        {data?.role === "office" && <Office data={data} busy={busy} call={call} />}
        {data?.role === "founder" && <Founder data={data} />}
      </div>
    </div>
  );
}

type Call = (method: string, body: object, okText: string) => Promise<boolean>;

function Investor({ data, busy, call }: { data: any; busy: boolean; call: Call }) {
  const [pick, setPick] = useState<any>(null);
  const [f, setF] = useState({ amount: "", instrument: "equity", terms: "" });
  const openFor = new Set(data.proposals.filter((p: any) => ["submitted", "pitch_scheduled"].includes(p.status)).map((p: any) => p.applicationId));
  return (
    <div>
      <p className="text-secondary font-body text-sm mt-1">Propose an investment in a CIMP-BIIF startup. The incubation team arranges the pitch and records the outcome.</p>

      {data.portfolio.length > 0 && (
        <section className="mt-6">
          <h2 className="font-body font-bold text-navy">Your portfolio</h2>
          <ul className="mt-3 grid md:grid-cols-2 gap-4">
            {data.portfolio.map((p: any) => {
              const r = p.latestReport?.answers ?? {};
              return (
                <li key={p.proposalId} className="bg-white border border-leaf-200 rounded-2xl p-5 shadow-card">
                  <p className="font-body font-bold text-navy">{p.startupName} <span className="text-xs font-mono text-muted font-normal">· {p.industry}</span></p>
                  <p className="text-xs font-mono text-muted">{p.amount} · {instrument(p.instrument)}</p>
                  {p.latestReport ? (
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[["Revenue", r.revenue != null ? `₹${Number(r.revenue).toLocaleString("en-IN")}` : "—"], ["Customers", r.customers ?? "—"], ["Team", r.teamSize ?? "—"]].map(([k, v]) => (
                        <div key={k as string} className="bg-surface-2 rounded-lg py-2"><dt className="text-[10px] font-mono text-muted uppercase">{k}</dt><dd className="text-sm font-semibold text-navy tabular-nums">{v}</dd></div>
                      ))}
                      <p className="col-span-3 text-[11px] text-muted font-body">From the accepted {periodLabel(p.latestReport.period)} progress report</p>
                    </dl>
                  ) : <p className="mt-3 text-xs text-muted font-body">No accepted progress report yet.</p>}
                  {p.connectionId && <Link href={`/messages?type=connection&id=${p.connectionId}`} className="inline-block mt-3 text-sm font-body font-semibold text-brand hover:underline">💬 Message the founders</Link>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div>
          <h2 className="font-body font-bold text-navy">Incubated startups</h2>
          <ul className="mt-3 grid sm:grid-cols-2 gap-4">
            {data.startups.map((s: any) => (
              <li key={s._id} className={`bg-white border rounded-2xl p-5 shadow-card ${pick?._id === s._id ? "border-brand" : "border-border"}`}>
                <p className="font-body font-bold text-navy">{s.startupName}</p>
                <p className="text-xs font-mono text-muted">{s.industry} · {s.ventureStage} · {[s.city, s.state].filter(Boolean).join(", ")}</p>
                <p className="text-sm text-secondary font-body mt-2">{s.idea}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button disabled={openFor.has(s._id)} onClick={() => setPick(s)} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold font-body disabled:opacity-40">{openFor.has(s._id) ? "Proposal open" : "Propose"}</button>
                  {s.isPublic && <Link href={`/startups/${s._id}`} target="_blank" className="text-xs font-body text-brand hover:underline">Profile ↗</Link>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-20">
          {pick && (
            <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3"
              onSubmit={async (e) => { e.preventDefault(); if (await call("POST", { applicationId: pick._id, ...f }, "Proposal sent to the incubation team.")) { setPick(null); setF({ amount: "", instrument: "equity", terms: "" }); } }}>
              <h3 className="font-body font-bold text-navy">Proposal for {pick.startupName}</h3>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Amount</span><input required maxLength={80} value={f.amount} onChange={(e) => setF((p) => ({ ...p, amount: e.target.value }))} placeholder="e.g. ₹25 lakh" className={input} /></label>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Instrument</span>
                <select value={f.instrument} onChange={(e) => setF((p) => ({ ...p, instrument: e.target.value }))} className={input}>{INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}</select></label>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Proposal and key terms</span><textarea required rows={4} maxLength={2000} value={f.terms} onChange={(e) => setF((p) => ({ ...p, terms: e.target.value }))} className={`${input} resize-none`} /></label>
              <div className="flex gap-2"><button type="button" onClick={() => setPick(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-body">Cancel</button><button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Send</button></div>
            </form>
          )}
          <div className="bg-white border border-border rounded-2xl shadow-card p-5">
            <h3 className="font-body font-bold text-navy text-sm">Your proposals</h3>
            {data.proposals.length === 0 ? <p className="text-sm text-muted font-body mt-2">None yet.</p> : (
              <ul className="mt-3 divide-y divide-border">
                {data.proposals.map((p: any) => (
                  <li key={p._id} className="py-3">
                    <div className="flex items-center gap-2"><span className="text-sm font-body font-semibold text-navy flex-1 truncate">{p.application.startupName}</span><Chip s={p.status} /></div>
                    <p className="text-xs font-mono text-muted">{p.amount} · {instrument(p.instrument)}</p>
                    {p.pitchAt && p.status === "pitch_scheduled" && <p className="text-xs font-body text-secondary mt-1">Pitch: {when(p.pitchAt)}</p>}
                    {p.officeNote && <p className="text-xs font-body text-muted mt-1">Office: {p.officeNote}</p>}
                    {["submitted", "pitch_scheduled"].includes(p.status) && (
                      <button disabled={busy} onClick={() => { if (window.confirm("Withdraw this proposal?")) call("PATCH", { proposalId: p._id, action: "withdraw" }, "Proposal withdrawn."); }} className="mt-1 text-xs font-body text-muted hover:text-red-700">Withdraw</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Office({ data, busy, call }: { data: any; busy: boolean; call: Call }) {
  const [pitch, setPitch] = useState<Record<string, string>>({});
  return (
    <div>
      <p className="text-secondary font-body text-sm mt-1">Proposals from approved investors. Arrange a pitch, then record the outcome. Founders hear about a proposal once a pitch is scheduled.</p>
      {data.proposals.length === 0 ? <p className="mt-6 bg-white border border-border rounded-2xl p-8 text-center text-muted font-body">No proposals yet.</p> : (
        <ul className="mt-6 space-y-4">
          {data.proposals.map((p: any) => (
            <li key={p._id} className="bg-white border border-border rounded-2xl p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-body font-bold text-navy">{p.investor.name} → {p.application.startupName}</p>
                <Chip s={p.status} />
                <span className="ml-auto text-xs font-mono text-muted">{new Date(p.createdAt).toLocaleDateString("en-IN")}</span>
              </div>
              <p className="text-xs font-mono text-muted">{p.amount} · {instrument(p.instrument)} · {p.investor.mentorProfile?.headline}{p.investor.mentorProfile?.ticketSize ? ` · usual ticket ${p.investor.mentorProfile.ticketSize}` : ""}</p>
              <p className="text-sm text-secondary font-body mt-2 whitespace-pre-line">{p.terms}</p>
              {p.pitchAt && <p className="text-xs font-body text-secondary mt-2">Pitch: {when(p.pitchAt)}{p.handledBy ? ` · arranged by ${p.handledBy}` : ""}</p>}
              {p.officeNote && <p className="text-xs font-body text-muted mt-1">Note: {p.officeNote}</p>}
              {data.canHandle && ["submitted", "pitch_scheduled"].includes(p.status) && (
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-end gap-3">
                  <label className="block"><span className="block text-xs text-muted font-body mb-1">Pitch date and time</span>
                    <input type="datetime-local" value={pitch[p._id] ?? ""} onChange={(e) => setPitch((x) => ({ ...x, [p._id]: e.target.value }))} className="bg-bg border border-border rounded-lg px-3 py-2 text-sm font-body" /></label>
                  <button disabled={busy || !pitch[p._id]} onClick={() => { const note = window.prompt("Note for the investor and founder (place, link; optional):") ?? ""; call("PATCH", { proposalId: p._id, action: "schedule_pitch", pitchAt: new Date(pitch[p._id]).toISOString(), note }, "Pitch scheduled; both sides notified."); }}
                    className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-40">{p.status === "pitch_scheduled" ? "Reschedule pitch" : "Schedule pitch"}</button>
                  <button disabled={busy} onClick={() => { const note = window.prompt("Note (optional, e.g. term sheet signed on…):") ?? ""; call("PATCH", { proposalId: p._id, action: "invested", note }, "Investment recorded."); }} className="px-4 py-2 rounded-xl border border-leaf-200 text-leaf-800 text-sm font-semibold font-body">Record investment</button>
                  <button disabled={busy} onClick={() => { const note = window.prompt("Reason (shared with the investor):")?.trim(); if (note) call("PATCH", { proposalId: p._id, action: "decline", note }, "Proposal closed."); }} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold font-body">Close</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Founder({ data }: { data: any }) {
  return (
    <div>
      <p className="text-secondary font-body text-sm mt-1">Investor pitches the incubation team has arranged for you.</p>
      {data.proposals.length === 0 ? <p className="mt-6 bg-white border border-border rounded-2xl p-8 text-center text-muted font-body">No investor pitches yet.</p> : (
        <ul className="mt-6 space-y-3">
          {data.proposals.map((p: any) => (
            <li key={p._id} className="bg-white border border-border rounded-2xl p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2"><p className="font-body font-bold text-navy">{p.investor.name}</p><Chip s={p.status} /></div>
              <p className="text-xs font-mono text-muted">{p.investor.mentorProfile?.headline} · {p.amount} · {instrument(p.instrument)}</p>
              {p.pitchAt && p.status === "pitch_scheduled" && <p className="text-sm font-body text-secondary mt-2">Pitch on {when(p.pitchAt)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
