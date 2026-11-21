"use client";
// Reports and Excel exports (PRD RBAC-5, XLS-1).
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { DATASETS, DATASET_KEYS, REPORT_ROLES, type DatasetKey } from "@/lib/exports";

type Bar = { label: string; count: number };
type Report = {
  totals: { applications: number; incubated: number; published: number; inReview: number; avgDaysToApproval: number | null };
  byStage: Bar[]; bySector: Bar[]; perMonth: Bar[];
  network: { mentorsApproved: number; investorsApproved: number; profilesPending: number; connectionsActive: number; connectionsOpen: number; sessionsHeld: number; sessionsUpcoming: number; avgRating: number | null; ratings: number };
  qpr: { label: string; expected: number; submitted: number; accepted: number; returned: number };
  proposals: { total: number; open: number; invested: number };
};
type Job = { _id: string; dataset: string; status: string; rowCount: number | null; createdAt: string; error: string | null; ready: boolean };

function Tile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 shadow-card">
      <p className="text-[11px] font-mono text-muted uppercase tracking-wider">{label}</p>
      <p className="font-display text-3xl font-bold text-navy mt-1 tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted font-body mt-1">{note}</p>}
    </div>
  );
}

/** One-series horizontal bars: label, bar, value. The value is printed, so the bar never carries meaning alone. */
function Bars({ title, rows, unit }: { title: string; rows: Bar[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="bg-white border border-border rounded-2xl p-5 shadow-card">
      <h2 className="font-body font-bold text-navy text-sm">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted font-body mt-3">No data yet.</p> : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[120px_1fr_36px] items-center gap-3 text-sm font-body" title={`${r.label}: ${r.count} ${unit}`}>
              <span className="text-secondary truncate">{r.label}</span>
              <span className="h-3 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
                <span className="block h-full bg-brand rounded-full" style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count ? 4 : 0 }} />
              </span>
              <span className="text-right text-navy font-semibold tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rep, setRep] = useState<Report | null>(null);
  const [dataset, setDataset] = useState<DatasetKey>("applications");
  const [cols, setCols] = useState<string[]>(DATASETS.applications.columns.filter((c) => c.default).map((c) => c.key));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user || !REPORT_ROLES.includes(d.user.role)) { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);

  const loadJobs = useCallback(async () => {
    const d = await fetch("/api/exports").then((r) => r.json());
    setJobs(d.jobs ?? []);
    return (d.jobs ?? []) as Job[];
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/reports").then((r) => r.json()).then(setRep);
    loadJobs();
  }, [user, loadJobs]);

  // Poll while a job is queued or running (PRD XLS-1: async jobs)
  useEffect(() => {
    if (!jobs.some((j) => j.status === "queued" || j.status === "running")) return;
    const t = setTimeout(loadJobs, 1500);
    return () => clearTimeout(t);
  }, [jobs, loadJobs]);

  function pick(d: DatasetKey) {
    setDataset(d); setFilters({});
    setCols(DATASETS[d].columns.filter((c) => c.default).map((c) => c.key));
  }

  async function start() {
    setMsg(null);
    const res = await fetch("/api/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset, columns: cols, filters }) });
    const d = await res.json();
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setMsg({ text: "Export started. It appears below when ready.", ok: true });
    loadJobs();
  }

  if (!user || !rep) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  const def = DATASETS[dataset];
  const n = rep.network, q = rep.qpr;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Reports</h1>
        <p className="text-secondary font-body text-sm mt-1">Live figures from the portal. Download any dataset as Excel below.</p>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Tile label="Applications" value={rep.totals.applications} note={`${rep.totals.inReview} in review`} />
          <Tile label="Incubated" value={rep.totals.incubated} note={`${rep.totals.published} published`} />
          <Tile label="Days to approval" value={rep.totals.avgDaysToApproval ?? "—"} note="Average, application to CEO approval" />
          <Tile label="Mentors" value={n.mentorsApproved} note={`${n.investorsApproved} also investors · ${n.profilesPending} pending`} />
          <Tile label="Sessions held" value={n.sessionsHeld} note={n.avgRating ? `Rated ${n.avgRating}/5 (${n.ratings} ratings)` : `${n.sessionsUpcoming} upcoming`} />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <Bars title="Applications by stage" rows={rep.byStage} unit="applications" />
          <Bars title="Applications by sector" rows={rep.bySector} unit="applications" />
          <Bars title="Applications received, last 6 months" rows={rep.perMonth} unit="applications" />
        </div>

        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <Tile label={`Progress reports · ${q.label}`} value={`${q.submitted}/${q.expected}`} note={`${q.accepted} accepted · ${q.returned} returned`} />
          <Tile label="Mentor connections" value={n.connectionsActive} note={`${n.connectionsOpen} requests in progress`} />
          <Tile label="Investment proposals" value={rep.proposals.total} note={`${rep.proposals.open} open · ${rep.proposals.invested} invested`} />
        </div>

        <section className="mt-8 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div className="bg-white border border-border rounded-2xl shadow-card p-6">
            <h2 className="font-body font-bold text-navy">Excel export</h2>
            <p className="text-xs text-muted font-body mt-1">Exports contain personal data. Each download is recorded in the audit log.</p>
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Dataset">
              {DATASET_KEYS.map((k) => (
                <button key={k} role="radio" aria-checked={dataset === k} onClick={() => pick(k)}
                  className={`px-3 py-1.5 rounded-full text-sm font-body border ${dataset === k ? "bg-brand text-white border-brand" : "bg-white text-secondary border-border hover:border-brand"}`}>{DATASETS[k].label}</button>
              ))}
            </div>
            {def.filters?.map((f) => (
              <label key={f.key} className="mt-4 block text-sm font-body text-secondary">{f.label}{" "}
                <select value={filters[f.key] ?? ""} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))} className="ml-2 bg-white border border-border rounded-lg px-3 py-1.5 text-sm">
                  <option value="">All</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select></label>
            ))}
            <fieldset className="mt-4">
              <legend className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2">Columns ({cols.length})</legend>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {def.columns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm font-body text-navy">
                    <input type="checkbox" checked={cols.includes(c.key)} onChange={(e) => setCols((p) => e.target.checked ? [...p, c.key] : p.filter((x) => x !== c.key))} className="w-4 h-4 accent-[#3F7A16]" />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {msg && <p role="status" className={`mt-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
            <button onClick={start} disabled={!cols.length} className="mt-4 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-40">Export to Excel</button>
          </div>

          <div className="bg-white border border-border rounded-2xl shadow-card p-5">
            <h2 className="font-body font-bold text-navy text-sm">Your exports</h2>
            {jobs.length === 0 ? <p className="text-sm text-muted font-body mt-2">None yet.</p> : (
              <ul className="mt-3 divide-y divide-border">
                {jobs.map((j) => (
                  <li key={j._id} className="py-2.5 flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-body text-navy truncate">{DATASETS[j.dataset as DatasetKey]?.label ?? j.dataset}</span>
                      <span className="block text-[11px] font-mono text-muted">{new Date(j.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{j.rowCount != null ? ` · ${j.rowCount} rows` : ""}</span>
                    </span>
                    {j.status === "done" && j.ready ? <a href={`/api/exports/${j._id}`} className="text-sm font-body font-semibold text-brand hover:underline">⬇ Download</a>
                      : j.status === "failed" ? <span className="text-xs font-body text-red-700" title={j.error ?? ""}>Failed</span>
                      : <span className="text-xs font-mono text-amber-700">{j.status === "queued" ? "Queued…" : "Building…"}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
