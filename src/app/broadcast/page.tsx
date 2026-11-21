"use client";
// Custom notification to a group (PRD NOT-3).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { AiDraft } from "@/components/AiTools";
import { DEDUP_MINUTES } from "@/lib/notify-shared";

type Audience = { key: string; label: string; count: number };
type Recent = { id: string; actorName: string; summary: string; at: string };
const SENDERS = ["executive", "manager", "ceo", "admin_it"];
const input = "w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";

export default function BroadcastPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<{ audiences: Audience[]; recent: Recent[] } | null>(null);
  const [f, setF] = useState({ audience: "incubated", title: "", message: "", email: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user || !SENDERS.includes(d.user.role)) { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);
  const load = useCallback(() => fetch("/api/notifications/blast").then((r) => r.json()).then(setData), []);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const a = data?.audiences.find((x) => x.key === f.audience);
    if (!window.confirm(`Send "${f.title}" to ${a?.label} (${a?.count} people)${f.email ? " by notification and email" : ""}?`)) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/notifications/blast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setMsg({ text: `Sent to ${d.sent} people${d.skipped ? `; ${d.skipped} skipped (already received it in the last ${DEDUP_MINUTES} minutes)` : ""}.`, ok: true });
    setF((p) => ({ ...p, title: "", message: "" }));
    load();
  }

  if (!user || !data) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Broadcast</h1>
        <p className="text-secondary font-body text-sm mt-1">Send an announcement to a group: a call for applications, an event, a deadline. Each send is recorded in the audit log.</p>
        <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          <form onSubmit={send} className="bg-white border border-border rounded-2xl shadow-card p-6 space-y-4">
            {msg && <p role="status" className={`text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
            <fieldset>
              <legend className="block text-sm font-body font-medium text-navy mb-2">Send to</legend>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.audiences.map((a) => (
                  <label key={a.key} className={`flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 cursor-pointer text-sm font-body ${f.audience === a.key ? "border-brand bg-leaf-50" : "border-border"}`}>
                    <span className="flex items-center gap-2"><input type="radio" name="aud" checked={f.audience === a.key} onChange={() => setF((p) => ({ ...p, audience: a.key }))} className="accent-[#3F7A16]" />{a.label}</span>
                    <span className="text-xs font-mono text-muted">{a.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <AiDraft kind="announcement" onDraft={(r) => setF((p) => ({ ...p, title: (r.title ?? p.title).slice(0, 100), message: r.text.slice(0, 1500) }))} />
            <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Title</span>
              <input required minLength={3} maxLength={100} value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Demo day on 12 December" className={input} /></label>
            <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Message</span>
              <textarea required minLength={5} maxLength={1500} rows={5} value={f.message} onChange={(e) => setF((p) => ({ ...p, message: e.target.value }))} className={`${input} resize-y`} /></label>
            <label className="flex items-center gap-2 text-sm font-body text-secondary">
              <input type="checkbox" checked={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.checked }))} className="w-4 h-4 accent-[#3F7A16]" /> Also send by email
            </label>
            <p className="text-xs text-muted font-body">Your name and role are added at the end. People who received the same message in the last {DEDUP_MINUTES} minutes are skipped.</p>
            <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
          </form>
          <aside className="bg-white border border-border rounded-2xl shadow-card p-5">
            <h2 className="font-body font-bold text-navy text-sm">Recent broadcasts</h2>
            {data.recent.length === 0 ? <p className="text-sm text-muted font-body mt-2">None yet.</p> : (
              <ul className="mt-3 space-y-3">
                {data.recent.map((r) => (
                  <li key={r.id} className="text-sm font-body">
                    <p className="text-navy">{r.summary}</p>
                    <p className="text-[11px] font-mono text-muted">{r.actorName} · {new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
