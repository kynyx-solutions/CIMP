"use client";
// AI assistant widgets (BIIF 2.0). Advice only; every result says so.
import { useState } from "react";

const NOTE = "AI suggestion from Claude. It can be wrong; check it against the application before relying on it.";

async function post(body: object) {
  const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({ error: "No reply" }));
  return res.ok ? { ok: true as const, result: d.result } : { ok: false as const, error: d.error as string };
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted">{title}</p>
      <ul className="list-disc pl-4 text-xs font-body text-navy space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

/** Reviewer briefing for an application (approvals side panel). */
export function AiApplicationReview({ applicationId }: { applicationId: string }) {
  const [state, setState] = useState<{ busy: boolean; error?: string; r?: any }>({ busy: false });
  return (
    <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-body font-semibold text-navy">✨ AI reviewer briefing</p>
        <button disabled={state.busy} onClick={async () => { setState({ busy: true }); const x = await post({ feature: "application_review", applicationId }); setState(x.ok ? { busy: false, r: x.result } : { busy: false, error: x.error }); }}
          className="text-[11px] font-body font-semibold text-violet-800 hover:underline disabled:opacity-50">{state.busy ? "Thinking…" : state.r ? "Refresh" : "Generate"}</button>
      </div>
      {state.error && <p role="alert" className="mt-2 text-[11px] font-body text-red-700">{state.error}</p>}
      {state.r && (
        <div className="mt-2">
          <p className="text-xs font-body text-navy">{state.r.summary}</p>
          <p className="mt-2 text-xs font-body"><span className="font-semibold text-navy">Fit {state.r.fitScore}/5</span> · suggests {state.r.suggestedProgram} · <span className="text-secondary">{state.r.fitRationale}</span></p>
          <List title="Strengths" items={state.r.strengths} />
          <List title="Risks and gaps" items={state.r.risks} />
          <List title="Questions for due diligence" items={state.r.questions} />
          <p className="mt-2 text-[10px] font-body text-muted">{NOTE} Contact details are not sent.</p>
        </div>
      )}
    </div>
  );
}

/** Summary and trends for a progress report (office QPR review). */
export function AiQprInsight({ reportId }: { reportId: string }) {
  const [state, setState] = useState<{ busy: boolean; error?: string; r?: any }>({ busy: false });
  return (
    <div className="mt-4 border border-violet-200 bg-violet-50/40 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-body font-semibold text-navy">✨ AI insight</p>
        <button disabled={state.busy} onClick={async () => { setState({ busy: true }); const x = await post({ feature: "qpr_insight", reportId }); setState(x.ok ? { busy: false, r: x.result } : { busy: false, error: x.error }); }}
          className="text-[11px] font-body font-semibold text-violet-800 hover:underline disabled:opacity-50">{state.busy ? "Thinking…" : state.r ? "Refresh" : "Compare with last quarter"}</button>
      </div>
      {state.error && <p role="alert" className="mt-2 text-[11px] font-body text-red-700">{state.error}</p>}
      {state.r && (
        <div className="mt-2">
          <p className="text-xs font-body text-navy">{state.r.summary}</p>
          <List title="Trends" items={state.r.trends} />
          <List title="Follow up" items={state.r.flags} />
          <List title="Support CIMP-BIIF could give" items={state.r.suggestedSupport} />
          <p className="mt-2 text-[10px] font-body text-muted">AI suggestion from Claude. It can be wrong; check it against the report.</p>
        </div>
      )}
    </div>
  );
}

/** "Draft with AI": turns a few points into an announcement, blog post or social post. */
export function AiDraft({ kind, platform, onDraft }: { kind: "announcement" | "blog" | "social"; platform?: string; onDraft: (r: { title: string | null; excerpt: string | null; text: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [tone, setTone] = useState("warm");
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-body font-semibold text-violet-800 hover:underline">✨ Draft with AI</button>;
  return (
    <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-3 space-y-2">
      <label className="block"><span className="block text-[11px] font-body text-muted mb-1">Key points (facts only; the draft will not add any)</span>
        <textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={3} maxLength={3000} className="w-full bg-white border border-border rounded-lg px-3 py-2 text-sm font-body resize-none" /></label>
      <div className="flex flex-wrap items-center gap-3">
        <select value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Tone" className="bg-white border border-border rounded-lg px-2 py-1 text-xs font-body">
          <option value="warm">Warm</option><option value="formal">Formal</option><option value="brief">Brief</option>
        </select>
        <button type="button" disabled={state.busy || points.trim().length < 10} onClick={async () => {
          setState({ busy: true });
          const x = await post({ feature: "draft", kind, points, tone, platform });
          if (x.ok) { onDraft(x.result); setState({ busy: false }); setOpen(false); setPoints(""); } else setState({ busy: false, error: x.error });
        }} className="px-3 py-1.5 rounded-lg bg-violet-700 text-white text-xs font-semibold font-body disabled:opacity-50">{state.busy ? "Writing…" : "Write draft"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-body text-muted">Cancel</button>
      </div>
      {state.error && <p role="alert" className="text-[11px] font-body text-red-700">{state.error}</p>}
      <p className="text-[10px] font-body text-muted">The draft replaces the text below; review and edit before sending.</p>
    </div>
  );
}
