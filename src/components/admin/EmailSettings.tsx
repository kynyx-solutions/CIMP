"use client";
// Email delivery status and test (PRD NOT-1).
import { useEffect, useState } from "react";

type Status = { mode: "smtp" | "gmail" | "log"; from: string; server: string | null };

export default function EmailSettings() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => { fetch("/api/admin/email").then((r) => r.json()).then(setS); }, []);

  async function test() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/email", { method: "POST" });
    const d = await res.json(); setBusy(false);
    setMsg(res.ok ? { text: d.mode === "log" ? `Logged to the server terminal (no mail server configured), addressed to ${d.to}.` : `Sent to ${d.to}. Check the inbox (and spam folder).`, ok: true } : { text: d.error, ok: false });
  }

  if (!s) return <p className="text-sm text-muted font-body">Loading…</p>;
  const live = s.mode !== "log";
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <section className="bg-white border border-border rounded-2xl shadow-card p-6">
        <div className={`text-sm font-body px-4 py-3 rounded-xl border ${live ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {live ? <>Emails are being sent through <strong>{s.server}</strong>.</> : <>No mail server is configured, so emails are written to the server terminal instead of being sent.</>}
        </div>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm font-body">
          <dt className="text-muted">Delivery</dt><dd className="text-navy font-semibold">{s.mode === "smtp" ? "SMTP" : s.mode === "gmail" ? "Gmail" : "Terminal log (development)"}</dd>
          <dt className="text-muted">Sender</dt><dd className="text-navy break-all">{s.from}</dd>
        </dl>
        {msg && <p role="status" className={`mt-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
        <button onClick={test} disabled={busy} className="mt-5 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">{busy ? "Sending…" : "Send a test email to me"}</button>
      </section>
      <aside className="bg-white border border-border rounded-2xl shadow-card p-5 text-sm font-body text-secondary">
        <h3 className="font-bold text-navy">How to turn on email</h3>
        <p className="mt-2">Add one option to the server&apos;s <code className="font-mono text-xs">.env.local</code>, then restart the server:</p>
        <p className="mt-3 font-semibold text-navy">Any SMTP provider</p>
        <pre className="mt-1 bg-surface-2 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto">SMTP_HOST=smtp.example.com{"\n"}SMTP_PORT=587{"\n"}SMTP_USER=…{"\n"}SMTP_PASS=…</pre>
        <p className="mt-3 font-semibold text-navy">Or a Google account</p>
        <pre className="mt-1 bg-surface-2 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto">GMAIL_USER=…@gmail.com{"\n"}GMAIL_APP_PASSWORD=…</pre>
        <p className="mt-2 text-xs text-muted">Gmail needs 2-step verification and an app password (Google Account → Security → App passwords). Set <code className="font-mono">MAIL_FROM</code> for the sender name.</p>
      </aside>
    </div>
  );
}
