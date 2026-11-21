"use client";
// Audit log screen (PRD AUD-1): CEO and Admin IT. Read-only, filterable, exportable.
import { useCallback, useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/workflow";

type Entry = {
  _id: string; at: string; actorName: string; actorRole: string; action: string;
  entity: string; entityId: string | null; summary: string; diff: Record<string, { from: unknown; to: unknown }> | null; ip: string | null;
};

const ENTITIES = [
  ["", "All areas"], ["application", "Applications"], ["document", "Documents"], ["mentor_profile", "Mentor profiles"],
  ["connection", "Connections"], ["message", "Messages"], ["user", "Office users"], ["auth", "Sign-ins"],
  ["form", "Form builder"], ["site_config", "Website content"],
] as const;

const show = (v: unknown) => (v == null || v === "" ? "—" : typeof v === "string" ? v : JSON.stringify(v));

export default function AuditLog() {
  const [filters, setFilters] = useState({ entity: "", actor: "", q: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const qs = useCallback((f: typeof filters, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...f, ...extra }).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  }, []);

  const load = useCallback(async (f: typeof filters, after?: string) => {
    const res = await fetch(`/api/admin/audit?${qs(f, after ? { cursor: after } : {})}`);
    const d = await res.json();
    if (!res.ok) { setEntries([]); return; }
    setEntries((prev) => (after && prev ? [...prev, ...d.entries] : d.entries));
    setCursor(d.nextCursor); setTotal(d.total);
  }, [qs]);

  useEffect(() => { load(applied); }, [applied, load]);

  const input = "bg-white border border-border rounded-lg px-3 py-2 text-sm font-body";
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setEntries(null); setApplied(filters); }}
        className="bg-white border border-border rounded-2xl p-4 shadow-card grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_auto_auto_auto] items-end">
        <label className="block"><span className="block text-[11px] font-mono text-muted uppercase mb-1">Area</span>
          <select value={filters.entity} onChange={(e) => setFilters((p) => ({ ...p, entity: e.target.value }))} className={input}>
            {ENTITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="block"><span className="block text-[11px] font-mono text-muted uppercase mb-1">Who</span>
          <input value={filters.actor} onChange={(e) => setFilters((p) => ({ ...p, actor: e.target.value }))} placeholder="Name" className={`${input} w-full`} /></label>
        <label className="block"><span className="block text-[11px] font-mono text-muted uppercase mb-1">Search</span>
          <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Startup, field, remark…" className={`${input} w-full`} /></label>
        <label className="block"><span className="block text-[11px] font-mono text-muted uppercase mb-1">From</span>
          <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} className={input} /></label>
        <label className="block"><span className="block text-[11px] font-mono text-muted uppercase mb-1">To</span>
          <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} className={input} /></label>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold font-body">Filter</button>
          <a href={`/api/admin/audit?${qs(applied, { format: "csv" })}`} className="px-4 py-2 rounded-lg border border-border text-sm font-body text-secondary hover:text-navy whitespace-nowrap">⬇ CSV</a>
        </div>
      </form>

      <p className="text-xs font-mono text-muted mt-4 mb-2">
        {entries === null ? "Loading…" : `${total.toLocaleString("en-IN")} record${total === 1 ? "" : "s"}`} · append-only: records cannot be edited or deleted
      </p>

      <div className="bg-white border border-border rounded-2xl shadow-card overflow-hidden">
        {entries?.length === 0 && <p className="p-10 text-center text-muted font-body text-sm">No records match these filters.</p>}
        <ul className="divide-y divide-border">
          {entries?.map((e) => {
            const hasDiff = e.diff && Object.keys(e.diff).length > 0;
            const expanded = open === e._id;
            return (
              <li key={e._id} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
                  <time dateTime={e.at} className="text-[11px] font-mono text-muted w-36 flex-shrink-0 pt-0.5">
                    {new Date(e.at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body text-navy break-words">{e.summary}</p>
                    <p className="text-[11px] font-mono text-muted mt-0.5">
                      {e.actorName} · {ROLE_LABELS[e.actorRole as keyof typeof ROLE_LABELS] ?? e.actorRole} · <span className="text-secondary">{e.action}</span>
                      {e.ip && <> · {e.ip}</>}
                    </p>
                  </div>
                  {hasDiff && (
                    <button onClick={() => setOpen(expanded ? null : e._id)} aria-expanded={expanded}
                      className="text-[11px] font-body font-semibold text-brand hover:underline flex-shrink-0">
                      {expanded ? "Hide changes" : `${Object.keys(e.diff!).length} change${Object.keys(e.diff!).length > 1 ? "s" : ""}`}
                    </button>
                  )}
                </div>
                {expanded && hasDiff && (
                  <table className="mt-3 w-full text-xs font-body border border-border rounded-lg overflow-hidden">
                    <thead className="bg-surface-2 text-left text-[10px] font-mono uppercase text-muted">
                      <tr><th className="px-3 py-2 w-1/5">Field</th><th className="px-3 py-2 w-2/5">Before</th><th className="px-3 py-2 w-2/5">After</th></tr>
                    </thead>
                    <tbody>
                      {Object.entries(e.diff!).map(([k, v]) => (
                        <tr key={k} className="border-t border-border align-top">
                          <td className="px-3 py-2 font-mono text-secondary">{k}</td>
                          <td className="px-3 py-2 text-red-800 bg-red-50/40 whitespace-pre-wrap break-words max-w-xs">{show(v.from)}</td>
                          <td className="px-3 py-2 text-leaf-800 bg-leaf-50/40 whitespace-pre-wrap break-words max-w-xs">{show(v.to)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            );
          })}
        </ul>
        {cursor && (
          <div className="p-3 border-t border-border text-center">
            <button disabled={loadingMore} onClick={async () => { setLoadingMore(true); await load(applied, cursor); setLoadingMore(false); }}
              className="text-sm font-body font-semibold text-brand disabled:opacity-50">{loadingMore ? "Loading…" : "Load older records"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
