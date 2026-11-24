"use client";
// "Find a mentor" for incubatees (PRD MEN-3): browse approved mentors/investors,
// request a connection, and follow each request through the office workflow (6.3).
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { CONN_STAGES, CONN_PIPELINE, CONN_TYPES, type ConnStatus } from "@/lib/network";
import Toast from "@/components/Toast";

type MentorRow = {
  _id: string; userId: string; headline: string; organisation?: string | null; expertise: string; sectors: string[];
  bio?: string | null; yearsExperience?: number | null; investorStatus: string; user: { name: string };
};
type Conn = { _id: string; status: string; type: string; message: string; createdAt: string; mentorId: string; mentor: { name: string; mentorProfile?: { headline: string } | null } };

export default function ConnectPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [sector, setSector] = useState("");
  const [investorsOnly, setInvestorsOnly] = useState(false);
  const [modal, setModal] = useState<MentorRow | null>(null);
  const [form, setForm] = useState({ type: "mentorship", message: "" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.user?.role !== "incubatee") { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    const [a, m, c] = await Promise.all([
      fetch("/api/applications").then((r) => r.json()),
      fetch("/api/mentors").then((r) => r.json()),
      fetch("/api/connections").then((r) => r.json()),
    ]);
    setApproved((a.applications ?? []).some((x: any) => x.status === "approved"));
    setMentors(m.profiles ?? []);
    setConns(c.connections ?? []);
  }

  function flash(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }

  async function request() {
    if (!modal) return;
    const res = await fetch("/api/connections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId: modal.userId, ...form }),
    });
    const d = await res.json();
    if (!res.ok) return flash(d.error, false);
    setModal(null); setForm({ type: "mentorship", message: "" });
    flash("Request sent. The incubation team will review it first.");
    load();
  }

  const sectors = useMemo(() => Array.from(new Set(mentors.flatMap((m) => m.sectors))).sort(), [mentors]);
  const list = mentors.filter((m) => (!sector || m.sectors.includes(sector)) && (!investorsOnly || m.investorStatus === "approved"));
  const openWith = new Set(conns.filter((c) => ["requested", "manager_approved", "routed", "active"].includes(c.status)).map((c) => c.mentorId));

  if (!user) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <Toast msg={msg} />

      {modal && (
        <div className="fixed inset-0 z-50 bg-navy/30 backdrop-blur-sm flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="req-title">
          <div className="bg-white border border-border rounded-2xl p-6 w-full max-w-md shadow-card-lg">
            <h2 id="req-title" className="font-display text-xl font-bold text-navy">Request a connection</h2>
            <p className="text-sm text-muted font-body mt-1">{modal.user.name} · {modal.headline}</p>
            <label className="block mt-4"><span className="block text-sm font-body font-medium text-navy mb-1.5">I am looking for</span>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm font-body">
                {CONN_TYPES.filter((t) => t.value === "mentorship" || modal.investorStatus === "approved").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></label>
            <label className="block mt-4"><span className="block text-sm font-body font-medium text-navy mb-1.5">Message</span>
              <textarea rows={4} maxLength={1500} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="What do you need help with, and why this mentor?" className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm font-body resize-none" /></label>
            <p className="text-xs text-muted font-body mt-2">The Incubation Manager reviews your request, the Senior Manager routes it, then the mentor accepts or declines.</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-body text-secondary">Cancel</button>
              <button onClick={request} disabled={!form.message.trim()} className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Send request</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Find a mentor</h1>
        <p className="text-secondary font-body text-sm mt-1">Request mentorship or an investment discussion with approved CIMP-BIIF mentors and investors.</p>

        {approved === false && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm font-body text-amber-800">
            Connections open once your incubation application is approved. You can browse mentors now. <Link href="/dashboard" className="underline font-semibold">Check your application</Link>
          </div>
        )}

        {/* My requests */}
        {conns.length > 0 && (
          <section className="mt-6 bg-white border border-border rounded-2xl p-6 shadow-card">
            <h2 className="font-body font-bold text-navy">My requests</h2>
            <ul className="mt-4 space-y-3">
              {conns.map((c) => {
                const st = c.status as ConnStatus;
                const idx = CONN_PIPELINE.indexOf(st);
                const closed = st === "declined" || st === "rejected";
                return (
                  <li key={c._id} className="border border-border rounded-xl p-4 bg-surface-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-body font-bold text-navy">{c.mentor.name} <span className="font-normal text-muted text-sm">· {c.mentor.mentorProfile?.headline}</span></p>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${st === "active" ? "bg-leaf-50 text-leaf-800 border-leaf-200" : closed ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>{CONN_STAGES[st]?.label}</span>
                    </div>
                    {!closed && (
                      <ol className="flex gap-1 mt-3" aria-label="Progress">
                        {CONN_PIPELINE.map((s, i) => <li key={s} title={CONN_STAGES[s].label} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-brand" : "bg-slate-200"}`} />)}
                      </ol>
                    )}
                    {CONN_STAGES[st]?.waitingOn && <p className="text-xs text-muted font-mono mt-1">Waiting on: {CONN_STAGES[st].waitingOn}</p>}
                    {st === "active" && (
                      <Link href={`/messages?type=connection&id=${c._id}`} className="inline-flex mt-3 px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold font-body hover:opacity-90">💬 Message your mentor</Link>
                    )}
                    {st === "active" && (
                      <Link href={`/mentorship/${c._id}`} className="inline-flex mt-3 ml-2 px-4 py-2 rounded-lg border border-border bg-white text-sm font-semibold font-body text-navy hover:border-brand">📅 Sessions &amp; documents</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Mentor directory */}
        <section className="mt-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter by sector" className="bg-white border border-border rounded-xl px-3 py-2 text-sm font-body">
              <option value="">All sectors</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm font-body text-secondary">
              <input type="checkbox" checked={investorsOnly} onChange={(e) => setInvestorsOnly(e.target.checked)} className="w-4 h-4 accent-[#3F7A16]" /> Investors only
            </label>
            <span className="text-sm font-mono text-muted">{list.length} available</span>
          </div>
          {list.length === 0 ? (
            <p className="bg-white border border-border rounded-2xl p-10 text-center text-muted font-body">No approved mentors match these filters yet.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.map((m) => (
                <li key={m._id} className="bg-white border border-border rounded-2xl p-5 shadow-card flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-11 h-11 rounded-full bg-leaf-50 border border-leaf-200 flex items-center justify-center font-bold text-brand" aria-hidden="true">{m.user.name.charAt(0)}</div>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${m.investorStatus === "approved" ? "text-saffron-600 bg-saffron-50 border-saffron-100" : "text-brand bg-leaf-50 border-leaf-200"}`}>
                      {m.investorStatus === "approved" ? "Mentor & Investor" : "Mentor"}
                    </span>
                  </div>
                  <h3 className="font-body font-bold text-navy mt-3">{m.user.name}</h3>
                  <p className="text-xs text-muted font-mono">{m.headline}{m.organisation ? ` · ${m.organisation}` : ""}</p>
                  <p className="text-sm text-secondary font-body mt-2 flex-1">{m.expertise}</p>
                  <ul className="flex flex-wrap gap-1.5 mt-3">
                    {m.sectors.map((s) => <li key={s} className="text-[11px] font-mono text-secondary bg-bg border border-border px-2 py-0.5 rounded-full">{s}</li>)}
                  </ul>
                  <button disabled={!approved || openWith.has(m.userId)} onClick={() => setModal(m)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                    {openWith.has(m.userId) ? "Request open" : "Request connection"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
