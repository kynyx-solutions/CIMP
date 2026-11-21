"use client";
// HR (BIIF 2.0): check in / out, leave with balances, approvals, and the team's day for managers.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ROLE_LABELS, isOfficeRole } from "@/lib/workflow";
import { ATTENDANCE_MODES, LEAVE_TYPES, leaveLabel, workingDays } from "@/lib/hr";

type Rec = { _id: string; date: string; checkIn: string; checkOut: string | null; mode: string; late: boolean };
type Leave = { _id: string; userName: string; userRole: string; type: string; fromDate: string; toDate: string; days: number; reason: string; status: string; approverName: string | null; decisionNote: string | null };
const time = (d: string) => new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
const input = "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";
const TONE: Record<string, string> = { pending: "bg-amber-50 text-amber-800 border-amber-200", approved: "bg-leaf-50 text-leaf-800 border-leaf-200", rejected: "bg-red-50 text-red-700 border-red-200", cancelled: "bg-slate-50 text-slate-600 border-slate-200" };

export default function HrPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [att, setAtt] = useState<{ today: string; todayRecord: Rec | null; records: Rec[]; canSeeTeam: boolean } | null>(null);
  const [lv, setLv] = useState<{ mine: Leave[]; balances: { type: string; label: string; quota: number | null; used: number; left: number | null }[]; toApprove: Leave[]; upcoming: Leave[]; approverRole: string | null } | null>(null);
  const [team, setTeam] = useState<any>(null);
  const [teamDate, setTeamDate] = useState("");
  const [mode, setMode] = useState("office");
  const [lf, setLf] = useState({ type: "casual", fromDate: "", toDate: "", halfDay: false, reason: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((x) => { if (!x.user || !isOfficeRole(x.user.role)) { router.push("/dashboard"); return; } setUser(x.user); }); }, [router]);
  const load = useCallback(async () => {
    const [a, l] = await Promise.all([fetch("/api/hr/attendance").then((r) => r.json()), fetch("/api/hr/leave").then((r) => r.json())]);
    setAtt(a); setLv(l);
    if (a.canSeeTeam) setTeam(await fetch(`/api/hr/attendance?team=1${teamDate ? `&date=${teamDate}` : ""}`).then((r) => r.json()));
  }, [teamDate]);
  useEffect(() => { if (user) load(); }, [user, load]);
  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };
  async function call(url: string, method: string, body: object, ok: string) {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const x = await res.json(); setBusy(false);
    if (!res.ok) { flash(x.error, false); return false; }
    flash(ok); await load(); return true;
  }

  if (!user || !att || !lv) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  const t = att.todayRecord;
  const days = lf.fromDate && lf.toDate ? workingDays(lf.fromDate, lf.toDate, lf.halfDay) : 0;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">HR</h1>
        <p className="text-secondary font-body text-sm mt-1">Attendance and leave for the office team. Demo policy: Monday to Saturday, check-in after 10:15 is marked late.</p>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <section className="bg-white border border-border rounded-2xl shadow-card p-5">
            <h2 className="text-[11px] font-mono text-muted uppercase tracking-wider">Today · {new Date(att.today).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</h2>
            {!t ? (
              <div className="mt-3 space-y-3">
                <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Where are you working today" className={input}>{ATTENDANCE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
                <button disabled={busy} onClick={() => call("/api/hr/attendance", "POST", { action: "check_in", mode }, "Checked in.")} className="w-full py-3 rounded-xl bg-brand text-white font-semibold font-body disabled:opacity-50">Check in</button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="font-display text-2xl font-bold text-navy">{time(t.checkIn)}{t.checkOut ? ` – ${time(t.checkOut)}` : ""}</p>
                <p className="text-xs font-body text-muted">{ATTENDANCE_MODES.find((m) => m.value === t.mode)?.label}{t.late ? " · late" : ""}</p>
                {!t.checkOut && <button disabled={busy} onClick={() => call("/api/hr/attendance", "POST", { action: "check_out" }, "Checked out.")} className="mt-3 w-full py-3 rounded-xl border border-border font-semibold font-body text-navy disabled:opacity-50">Check out</button>}
              </div>
            )}
          </section>
          <section className="bg-white border border-border rounded-2xl shadow-card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-mono text-muted uppercase tracking-wider">Leave balance {new Date().getFullYear()}</h2>
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {lv.balances.map((b) => <li key={b.type} className="bg-surface-2 border border-border rounded-xl p-3"><p className="text-xs font-body text-muted">{b.label}</p><p className="font-display text-xl font-bold text-navy tabular-nums">{b.left ?? "—"}<span className="text-xs font-body text-muted font-normal">{b.quota !== null ? ` / ${b.quota} left` : ` (${b.used} taken)`}</span></p></li>)}
            </ul>
          </section>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-6">
            {lv.toApprove.length > 0 && (
              <section className="bg-white border border-amber-300 rounded-2xl shadow-card p-5">
                <h2 className="font-body font-bold text-navy text-sm">Leave waiting for your approval</h2>
                <ul className="mt-3 space-y-3">
                  {lv.toApprove.map((l) => (
                    <li key={l._id} className="border border-border rounded-xl p-3 text-sm font-body">
                      <p><strong className="text-navy">{l.userName}</strong> <span className="text-muted">({ROLE_LABELS[l.userRole] ?? l.userRole})</span> · {leaveLabel(l.type)} · {l.fromDate} to {l.toDate} ({l.days} day{l.days === 1 ? "" : "s"})</p>
                      <p className="text-secondary mt-1">{l.reason}</p>
                      <div className="mt-2 flex gap-2">
                        <button disabled={busy} onClick={() => call("/api/hr/leave", "PATCH", { id: l._id, action: "approve" }, "Approved.")} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">Approve</button>
                        <button disabled={busy} onClick={() => { const note = window.prompt("Reason:")?.trim(); if (note) call("/api/hr/leave", "PATCH", { id: l._id, action: "reject", note }, "Rejected."); }} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold">Reject</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {team && (
              <section className="bg-white border border-border rounded-2xl shadow-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-body font-bold text-navy text-sm">Team on</h2>
                  <input type="date" value={teamDate || team.date} onChange={(e) => setTeamDate(e.target.value)} aria-label="Date" className="bg-bg border border-border rounded-lg px-2 py-1 text-sm font-body" />
                  <span className="text-xs font-mono text-muted">{team.summary.present} present · {team.summary.late} late · {team.summary.onLeave} on leave · {team.summary.absent} not marked</span>
                </div>
                <table className="mt-3 w-full text-sm font-body">
                  <thead className="text-left text-[11px] font-mono text-muted uppercase"><tr><th className="py-2">Name</th><th>Role</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
                  <tbody>
                    {team.team.map((m: any) => (
                      <tr key={m.userId} className="border-t border-border">
                        <td className="py-2 font-semibold text-navy">{m.name}</td><td className="text-secondary">{ROLE_LABELS[m.role] ?? m.role}</td>
                        <td>{m.record ? time(m.record.checkIn) : "—"}</td><td>{m.record?.checkOut ? time(m.record.checkOut) : "—"}</td>
                        <td>{m.leave ? <span className="text-sky-800">{leaveLabel(m.leave)}</span> : m.record ? (m.record.late ? <span className="text-amber-800">Late · {m.record.mode}</span> : <span className="text-leaf-800">Present · {m.record.mode}</span>) : <span className="text-muted">Not marked</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            <section className="bg-white border border-border rounded-2xl shadow-card p-5">
              <h2 className="font-body font-bold text-navy text-sm">My attendance this month</h2>
              {att.records.length === 0 ? <p className="text-sm text-muted font-body mt-2">No records yet.</p> : (
                <ul className="mt-2 divide-y divide-border text-sm font-body">
                  {att.records.map((r) => <li key={r._id} className="py-2 flex gap-3"><span className="font-mono text-muted w-24">{r.date}</span><span className="text-navy">{time(r.checkIn)}{r.checkOut ? ` – ${time(r.checkOut)}` : " – …"}</span><span className="text-xs text-muted">{r.mode}{r.late ? " · late" : ""}</span></li>)}
                </ul>
              )}
            </section>
            <section className="bg-white border border-border rounded-2xl shadow-card p-5">
              <h2 className="font-body font-bold text-navy text-sm">My leave</h2>
              {lv.mine.length === 0 ? <p className="text-sm text-muted font-body mt-2">None yet.</p> : (
                <ul className="mt-2 divide-y divide-border text-sm font-body">
                  {lv.mine.map((l) => (
                    <li key={l._id} className="py-2 flex flex-wrap items-center gap-2">
                      <span className="text-navy">{leaveLabel(l.type)} · {l.fromDate} to {l.toDate} ({l.days})</span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${TONE[l.status]}`}>{l.status}</span>
                      {l.decisionNote && <span className="text-xs text-muted">{l.approverName}: {l.decisionNote}</span>}
                      {["pending", "approved"].includes(l.status) && l.fromDate > att.today && <button onClick={() => call("/api/hr/leave", "PATCH", { id: l._id, action: "cancel" }, "Cancelled.")} className="ml-auto text-xs text-muted hover:text-red-700">Cancel</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3 lg:sticky lg:top-20"
            onSubmit={async (e) => { e.preventDefault(); if (await call("/api/hr/leave", "POST", lf, lv.approverRole ? "Leave requested." : "Leave recorded.")) setLf({ type: "casual", fromDate: "", toDate: "", halfDay: false, reason: "" }); }}>
            <h2 className="font-body font-bold text-navy">Apply for leave</h2>
            <select value={lf.type} onChange={(e) => setLf((f) => ({ ...f, type: e.target.value }))} aria-label="Leave type" className={input}>{LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="block text-xs text-muted font-body mb-1">From</span><input required type="date" value={lf.fromDate} onChange={(e) => setLf((f) => ({ ...f, fromDate: e.target.value, toDate: f.toDate || e.target.value }))} className={input} /></label>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">To</span><input required type="date" value={lf.toDate} min={lf.fromDate} onChange={(e) => setLf((f) => ({ ...f, toDate: e.target.value }))} className={input} /></label>
            </div>
            {lf.fromDate && lf.fromDate === lf.toDate && <label className="flex items-center gap-2 text-sm font-body text-secondary"><input type="checkbox" checked={lf.halfDay} onChange={(e) => setLf((f) => ({ ...f, halfDay: e.target.checked }))} className="accent-[#3F7A16]" /> Half day</label>}
            <textarea required rows={3} value={lf.reason} onChange={(e) => setLf((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason" aria-label="Reason" className={`${input} resize-none`} />
            {days > 0 && <p className="text-xs font-body text-muted">{days} working day{days === 1 ? "" : "s"}{lv.approverRole ? ` · approved by the ${lv.approverRole === "ceo" ? "CEO" : "Senior Manager"}` : " · recorded directly"}</p>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Apply</button>
          </form>
        </div>
      </div>
    </div>
  );
}
