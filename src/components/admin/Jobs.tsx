"use client";
// Scheduled jobs (PRD QPR-2, REM-1, IDC-1): schedule, recent runs, run now.
import { useCallback, useEffect, useState } from "react";

type Run = { id: string; trigger: string; status: string; summary: string | null; startedAt: string };
type Job = { key: string; label: string; schedule: string; cron: string; desc: string; runs: Run[] };

export default function Jobs() {
  const [data, setData] = useState<{ jobs: Job[]; schedulerConfigured: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const load = useCallback(() => fetch("/api/admin/jobs").then((r) => r.json()).then(setData), []);
  useEffect(() => { load(); }, [load]);

  async function run(j: Job) {
    if (!window.confirm(`Run "${j.label}" now? It sends real notifications and emails.`)) return;
    setBusy(j.key); setMsg(null);
    const res = await fetch("/api/admin/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job: j.key }) });
    const d = await res.json(); setBusy(null);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setMsg({ text: `${j.label}: ${d.run.summary ?? d.run.status}`, ok: d.run.status === "ok" });
    load();
  }

  if (!data) return <p className="text-sm text-muted font-body">Loading…</p>;
  return (
    <div>
      <p className={`mb-4 text-sm font-body px-4 py-2.5 rounded-xl border ${data.schedulerConfigured ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        {data.schedulerConfigured ? "The scheduler is configured: jobs run automatically at the times below." : "Demo: no scheduler is connected, so jobs run only when started here. In production a scheduler calls them at the times below. Repeat notifications within 10 minutes are skipped."}
      </p>
      {msg && <p role="status" className={`mb-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
      <div className="grid lg:grid-cols-3 gap-4">
        {data.jobs.map((j) => (
          <section key={j.key} className="bg-white border border-border rounded-2xl shadow-card p-5 flex flex-col">
            <h3 className="font-body font-bold text-navy">{j.label}</h3>
            <p className="text-xs font-mono text-muted mt-0.5">{j.schedule} · <span title="cron expression">{j.cron}</span></p>
            <p className="text-sm text-secondary font-body mt-2">{j.desc}</p>
            <ul className="mt-3 space-y-2 flex-1">
              {j.runs.length === 0 && <li className="text-xs text-muted font-body">Never run.</li>}
              {j.runs.map((r) => (
                <li key={r.id} className="text-xs font-body">
                  <span className={r.status === "ok" ? "text-leaf-800" : r.status === "failed" ? "text-red-700" : "text-amber-700"}>{r.status === "ok" ? "✓" : r.status === "failed" ? "✕" : "…"}</span>{" "}
                  <span className="font-mono text-muted">{new Date(r.startedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {r.trigger}</span>
                  {r.summary && <span className="block text-secondary">{r.summary}</span>}
                </li>
              ))}
            </ul>
            <button disabled={busy === j.key} onClick={() => run(j)} className="mt-4 px-4 py-2 rounded-xl border border-border text-sm font-semibold font-body text-navy hover:border-brand disabled:opacity-50">{busy === j.key ? "Running…" : "Run now"}</button>
          </section>
        ))}
      </div>
    </div>
  );
}
