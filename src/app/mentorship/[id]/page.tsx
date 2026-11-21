"use client";
// One mentorship (PRD MEN-4): sessions, feedback and document requests between a mentor and a startup.
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { SESSION_MODES } from "@/lib/mentorship";
import { formatBytes } from "@/lib/documents";

type Feedback = { _id: string; authorId: string; authorRole: string; rating: number; comment: string | null };
type Session = { _id: string; scheduledAt: string; durationMin: number; mode: string; location: string | null; agenda: string; status: string; cancelReason: string | null; feedback: Feedback[]; myFeedback: Feedback | null };
type DocReq = { _id: string; title: string; note: string | null; status: string; fileName: string | null; size: number | null; uploadedAt: string | null; createdAt: string };
type Data = { connection: { _id: string; mentorName: string; menteeName: string; startupName: string | null }; role: "mentor" | "mentee" | "office"; canAct: boolean; sessions: Session[]; docRequests: DocReq[] };

const when = (d: string) => new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const input = "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";
const chip = (s: string) => s === "completed" || s === "uploaded" ? "bg-leaf-50 text-leaf-800 border-leaf-200" : s === "cancelled" || s === "closed" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-amber-50 text-amber-800 border-amber-200";
const Stars = ({ n }: { n: number }) => <span aria-label={`${n} out of 5`} className="text-saffron-500 tracking-tight">{"★".repeat(n)}<span className="text-slate-300">{"★".repeat(5 - n)}</span></span>;

function localInputValue(d: Date) { const p = (x: number) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

export default function MentorshipPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const tomorrow = new Date(Date.now() + 864e5); tomorrow.setHours(11, 0, 0, 0);
  const [sf, setSf] = useState({ scheduledAt: localInputValue(tomorrow), durationMin: "60", mode: "virtual", location: "", agenda: "" });
  const [rf, setRf] = useState({ title: "", note: "" });
  const [fb, setFb] = useState<Record<string, { rating: number; comment: string }>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (!d.user) { router.push("/login"); return; } setUser(d.user); });
  }, [router]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/mentorship?connectionId=${id}`);
    const d = await res.json();
    if (!res.ok) { setError(d.error || "Not available"); return; }
    setData(d);
  }, [id]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };
  async function call(method: string, body: object, okText: string) {
    setBusy(true);
    const res = await fetch("/api/mentorship", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { flash(d.error, false); return false; }
    flash(okText); await load(); return true;
  }
  async function upload(reqId: string, file: File) {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`/api/mentorship/doc/${reqId}`, { method: "POST", body: fd });
    const d = await res.json(); setBusy(false);
    if (!res.ok) flash(d.error, false); else { flash("Uploaded. Your mentor has been notified."); load(); }
  }

  if (!user || (!data && !error)) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (error || !data) return (
    <div className="min-h-screen bg-bg"><Navbar user={user} />
      <p className="max-w-xl mx-auto mt-16 bg-white border border-border rounded-2xl p-8 text-center font-body text-secondary">This mentorship is not available. It opens once the mentor accepts the connection. <Link href="/messages" className="text-brand underline">Messages</Link></p>
    </div>
  );

  const { connection: c, role, canAct } = data;
  const now = Date.now();
  const upcoming = data.sessions.filter((s) => s.status === "scheduled").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const past = data.sessions.filter((s) => s.status !== "scheduled");
  const ratings = data.sessions.flatMap((s) => s.feedback);
  const avg = ratings.length ? (ratings.reduce((n, f) => n + f.rating, 0) / ratings.length).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs font-mono text-muted"><Link href={role === "mentor" ? "/mentor" : role === "mentee" ? "/connect" : "/network"} className="hover:text-brand">← Back</Link></p>
        <h1 className="font-display text-3xl font-bold text-navy mt-2">Mentorship: {c.startupName ?? c.menteeName}</h1>
        <p className="text-secondary font-body text-sm mt-1">
          Mentor {c.mentorName} · Founder {c.menteeName}
          {avg && <> · Average session rating <strong className="text-navy">{avg}/5</strong></>}
          {" · "}<Link href={`/messages?type=connection&id=${c._id}`} className="text-brand font-semibold hover:underline">Messages</Link>
        </p>
        {role === "office" && <p className="mt-3 text-xs font-body text-muted bg-white border border-border rounded-lg px-3 py-2 inline-block">Read-only: the office can follow mentorships for oversight.</p>}

        <div className="mt-6 grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-6">
            {/* Sessions */}
            <section className="bg-white border border-border rounded-2xl shadow-card p-6">
              <h2 className="font-body font-bold text-navy">Upcoming sessions <span className="text-muted font-mono text-xs">({upcoming.length})</span></h2>
              {upcoming.length === 0 ? <p className="text-sm text-muted font-body mt-2">Nothing scheduled.</p> : (
                <ul className="mt-3 space-y-3">
                  {upcoming.map((s) => (
                    <li key={s._id} className="border border-border rounded-xl p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body font-semibold text-navy">{when(s.scheduledAt)}</p>
                        <span className="text-xs font-mono text-muted">{s.durationMin} min · {s.mode === "virtual" ? "Video call" : "In person"}</span>
                      </div>
                      {s.location && (s.mode === "virtual"
                        ? <a href={s.location} target="_blank" rel="noopener noreferrer" className="text-sm text-brand font-body underline break-all">{s.location}</a>
                        : <p className="text-sm text-secondary font-body">📍 {s.location}</p>)}
                      <p className="text-sm text-secondary font-body mt-2 whitespace-pre-line">{s.agenda}</p>
                      {canAct && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button disabled={busy || new Date(s.scheduledAt).getTime() > now} title={new Date(s.scheduledAt).getTime() > now ? "Available once the session has started" : ""}
                            onClick={() => call("PATCH", { kind: "session", sessionId: s._id, action: "complete" }, "Marked completed. Please give feedback.")}
                            className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold font-body disabled:opacity-40">Mark completed</button>
                          <button disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling (shared with the other side):")?.trim(); if (reason) call("PATCH", { kind: "session", sessionId: s._id, action: "cancel", reason }, "Session cancelled."); }}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-body text-secondary">Cancel</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {past.length > 0 && (
                <>
                  <h3 className="font-body font-bold text-navy text-sm mt-6">Past sessions</h3>
                  <ul className="mt-2 space-y-3">
                    {past.map((s) => {
                      const draft = fb[s._id] ?? { rating: 0, comment: "" };
                      return (
                        <li key={s._id} className="border border-border rounded-xl p-4 bg-surface-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-body font-semibold text-navy text-sm">{when(s.scheduledAt)}</p>
                            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${chip(s.status)}`}>{s.status === "completed" ? "Completed" : "Cancelled"}</span>
                          </div>
                          <p className="text-xs text-secondary font-body mt-1 line-clamp-2">{s.agenda}</p>
                          {s.cancelReason && <p className="text-xs text-muted font-body mt-1">Reason: {s.cancelReason}</p>}
                          {s.feedback.map((f) => (
                            <p key={f._id} className="text-xs font-body text-secondary mt-2"><Stars n={f.rating} /> <span className="text-muted">{f.authorRole === "mentor" ? "Mentor" : "Founder"}</span>{f.comment ? `: ${f.comment}` : ""}</p>
                          ))}
                          {canAct && s.status === "completed" && s.myFeedback && s.feedback.length < 2 && <p className="text-[11px] text-muted font-body mt-1">The other side's rating shows once they give theirs.</p>}
                          {canAct && s.status === "completed" && !s.myFeedback && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-xs font-body font-semibold text-navy">How useful was this session?</p>
                              <div role="radiogroup" aria-label="Rating" className="flex gap-1 mt-1">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <button key={n} role="radio" aria-checked={draft.rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                                    onClick={() => setFb((p) => ({ ...p, [s._id]: { ...draft, rating: n } }))}
                                    className={`text-xl leading-none ${n <= draft.rating ? "text-saffron-500" : "text-slate-300"} hover:text-saffron-500`}>★</button>
                                ))}
                              </div>
                              <textarea value={draft.comment} onChange={(e) => setFb((p) => ({ ...p, [s._id]: { ...draft, comment: e.target.value } }))} rows={2} maxLength={1500}
                                placeholder="What helped? What should change? (optional)" aria-label="Feedback comment" className={`${input} mt-2 resize-none text-xs`} />
                              <button disabled={busy || !draft.rating} onClick={() => call("POST", { kind: "feedback", sessionId: s._id, ...draft }, "Thanks for the feedback.")}
                                className="mt-2 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold font-body disabled:opacity-40">Send feedback</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            {/* Document requests */}
            <section className="bg-white border border-border rounded-2xl shadow-card p-6">
              <h2 className="font-body font-bold text-navy">Documents requested by the mentor</h2>
              {data.docRequests.length === 0 ? <p className="text-sm text-muted font-body mt-2">No requests yet.</p> : (
                <ul className="mt-3 space-y-3">
                  {data.docRequests.map((d) => (
                    <li key={d._id} className="border border-border rounded-xl p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body font-semibold text-navy text-sm">{d.title}</p>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${chip(d.status)}`}>{d.status === "requested" ? "Waiting for upload" : d.status === "uploaded" ? "Uploaded" : "Closed"}</span>
                      </div>
                      {d.note && <p className="text-xs text-secondary font-body mt-1">{d.note}</p>}
                      {d.fileName && <a href={`/api/mentorship/doc/${d._id}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-brand font-body underline mt-2">📎 {d.fileName}{d.size ? ` · ${formatBytes(d.size)}` : ""}</a>}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {canAct && role === "mentee" && d.status !== "closed" && (
                          <>
                            <button disabled={busy} onClick={() => fileRefs.current[d._id]?.click()} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold font-body text-navy hover:border-brand">{d.fileName ? "Replace file" : "Upload"}</button>
                            <input ref={(el) => { fileRefs.current[d._id] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png,.ppt,.pptx" className="hidden" aria-label={`Upload ${d.title}`}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(d._id, f); e.target.value = ""; }} />
                          </>
                        )}
                        {canAct && role === "mentor" && d.status !== "closed" && (
                          <button disabled={busy} onClick={() => call("PATCH", { kind: "doc_request", requestId: d._id, action: "close" }, "Request closed.")} className="text-xs font-body text-muted hover:text-navy">Close request</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {canAct && (
            <aside className="space-y-6 lg:sticky lg:top-20">
              <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3"
                onSubmit={async (e) => { e.preventDefault(); if (await call("POST", { kind: "session", connectionId: c._id, ...sf, scheduledAt: new Date(sf.scheduledAt).toISOString(), durationMin: Number(sf.durationMin) }, "Session scheduled. The other side has been notified.")) setSf((p) => ({ ...p, agenda: "", location: "" })); }}>
                <h2 className="font-body font-bold text-navy">Schedule a session</h2>
                <label className="block"><span className="block text-xs font-body text-muted mb-1">Date and time</span>
                  <input type="datetime-local" required value={sf.scheduledAt} onChange={(e) => setSf((p) => ({ ...p, scheduledAt: e.target.value }))} className={input} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="block text-xs font-body text-muted mb-1">Duration</span>
                    <select value={sf.durationMin} onChange={(e) => setSf((p) => ({ ...p, durationMin: e.target.value }))} className={input}>
                      {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
                    </select></label>
                  <label className="block"><span className="block text-xs font-body text-muted mb-1">Mode</span>
                    <select value={sf.mode} onChange={(e) => setSf((p) => ({ ...p, mode: e.target.value }))} className={input}>
                      {SESSION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select></label>
                </div>
                <label className="block"><span className="block text-xs font-body text-muted mb-1">{sf.mode === "virtual" ? "Meeting link (optional)" : "Place"}</span>
                  <input value={sf.location} onChange={(e) => setSf((p) => ({ ...p, location: e.target.value }))} required={sf.mode === "physical"} maxLength={300}
                    placeholder={sf.mode === "virtual" ? "https://meet.google.com/…" : "e.g. B-Hub meeting room 2"} className={input} /></label>
                <label className="block"><span className="block text-xs font-body text-muted mb-1">Agenda</span>
                  <textarea value={sf.agenda} onChange={(e) => setSf((p) => ({ ...p, agenda: e.target.value }))} required rows={3} maxLength={1500} className={`${input} resize-none`} /></label>
                <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Schedule</button>
              </form>

              {role === "mentor" && (
                <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3"
                  onSubmit={async (e) => { e.preventDefault(); if (await call("POST", { kind: "doc_request", connectionId: c._id, ...rf }, "Request sent to the startup.")) setRf({ title: "", note: "" }); }}>
                  <h2 className="font-body font-bold text-navy">Request a document</h2>
                  <label className="block"><span className="block text-xs font-body text-muted mb-1">Document</span>
                    <input required value={rf.title} onChange={(e) => setRf((p) => ({ ...p, title: e.target.value }))} maxLength={120} placeholder="e.g. Last 6 months' sales sheet" className={input} /></label>
                  <label className="block"><span className="block text-xs font-body text-muted mb-1">Note (optional)</span>
                    <textarea value={rf.note} onChange={(e) => setRf((p) => ({ ...p, note: e.target.value }))} rows={2} maxLength={1000} className={`${input} resize-none`} /></label>
                  <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold font-body text-navy hover:border-brand disabled:opacity-50">Send request</button>
                </form>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
