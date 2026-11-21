"use client";
// AI assistant settings and usage (Admin IT edits; CEO views).
import { useCallback, useEffect, useState } from "react";

const FEATURE: Record<string, string> = { application_review: "Reviewer briefings", qpr_insight: "Report insights", draft: "Drafts" };

export default function AiSettings() {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const load = useCallback(() => fetch("/api/ai").then((r) => r.json()).then(setD), []);
  useEffect(() => { load(); }, [load]);
  async function toggle(enabled: boolean) {
    const res = await fetch("/api/ai", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    const x = await res.json();
    setMsg(res.ok ? { text: enabled ? "AI assistant switched on." : "AI assistant switched off.", ok: true } : { text: x.error, ok: false });
    load();
  }
  if (!d) return <p className="text-sm text-muted font-body">Loading…</p>;
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <section className="bg-white border border-border rounded-2xl shadow-card p-6">
        <div className={`text-sm font-body px-4 py-3 rounded-xl border ${d.available ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {d.available ? `On. Reviewers and writers can use Claude (${d.model}).` : d.reason}
        </div>
        {msg && <p role="status" className={`mt-3 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
        <dl className="mt-4 grid grid-cols-[160px_1fr] gap-y-2 text-sm font-body">
          <dt className="text-muted">API key on the server</dt><dd className="text-navy font-semibold">{d.configured ? "Configured" : "Missing (ANTHROPIC_API_KEY)"}</dd>
          <dt className="text-muted">Switched on</dt><dd className="text-navy font-semibold">{d.enabled ? "Yes" : "No"}</dd>
          <dt className="text-muted">Limit</dt><dd className="text-navy">{d.limitPerHour} requests per person per hour</dd>
        </dl>
        {d.canEdit && <button onClick={() => toggle(!d.enabled)} className={`mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold font-body ${d.enabled ? "border border-border text-navy" : "bg-brand text-white"}`}>{d.enabled ? "Switch off" : "Switch on"}</button>}
        <h3 className="mt-8 font-body font-bold text-navy text-sm">This month</h3>
        <p className="text-sm font-body text-secondary mt-1">{d.month.runs} requests ({d.month.failed} failed) · {(d.month.inputTokens + d.month.outputTokens).toLocaleString("en-IN")} tokens · about ${d.month.estimatedUsd.toFixed(2)} at list price</p>
        <ul className="mt-2 text-sm font-body text-secondary">{Object.entries(d.month.byFeature).map(([k, v]) => <li key={k}>{FEATURE[k] ?? k}: {String(v)}</li>)}</ul>
        <h3 className="mt-6 font-body font-bold text-navy text-sm">Recent</h3>
        <ul className="mt-2 divide-y divide-border text-xs font-body">
          {d.recent.length === 0 && <li className="py-2 text-muted">No requests yet.</li>}
          {d.recent.map((r: any) => <li key={r.id} className="py-2 flex flex-wrap gap-2"><span className="font-mono text-muted">{new Date(r.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span><span className="text-navy">{r.userName}</span><span className="text-secondary">{FEATURE[r.feature] ?? r.feature}</span><span className={r.status === "ok" ? "text-leaf-800" : "text-red-700"}>{r.status === "ok" ? `${r.tokens.toLocaleString("en-IN")} tokens` : r.error}</span></li>)}
        </ul>
      </section>
      <aside className="bg-white border border-border rounded-2xl shadow-card p-5 text-sm font-body text-secondary space-y-2">
        <h3 className="font-bold text-navy">What it does</h3>
        <p><strong className="text-navy">Reviewer briefings</strong> in Applications: summary, strengths, risks, due-diligence questions and a fit score.</p>
        <p><strong className="text-navy">Report insights</strong> in Progress: this quarter against the last, with points to follow up.</p>
        <p><strong className="text-navy">Drafts</strong> for broadcasts, blog posts and social posts, from the points you give.</p>
        <h3 className="font-bold text-navy pt-2">Data and privacy</h3>
        <p>Phone numbers and email addresses are removed before text is sent to Anthropic. Documents are not sent. Every request is logged here and in the audit log. Results are advice: decisions stay with the office.</p>
      </aside>
    </div>
  );
}
