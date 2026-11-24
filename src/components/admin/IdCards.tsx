"use client";
// ID cards in the admin panel (PRD IDC-1): Admin IT issues, renews and revokes; the CEO views.
import { useCallback, useEffect, useState } from "react";

type Row = { userId: string; name: string; email: string; roleLabel: string; organisation: string | null; ineligible?: boolean;
  card: { number: string; status: string; issuedAt: string; expiresAt: string; lastEmailedAt: string | null } | null };
const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function IdCards() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canIssue, setCanIssue] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const load = useCallback(async () => { const d = await fetch("/api/idcards").then((r) => r.json()); setRows(d.rows ?? []); setCanIssue(!!d.canIssue); }, []);
  useEffect(() => { load(); }, [load]);

  async function act(r: Row, method: "POST" | "PATCH") {
    let reason = "";
    if (method === "PATCH") { reason = window.prompt(`Reason for revoking ${r.name}'s card:`)?.trim() ?? ""; if (!reason) return; }
    setBusy(r.userId); setMsg(null);
    const res = await fetch("/api/idcards", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: r.userId, action: "revoke", reason }) });
    const d = await res.json(); setBusy(null);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setMsg({ text: method === "PATCH" ? "Card revoked." : `${d.renewed ? "Renewed" : "Issued"} ${d.card.number} and emailed it to ${r.name}.`, ok: true });
    load();
  }

  if (!rows) return <p className="text-sm text-muted font-body">Loading…</p>;
  const state = (c: Row["card"]) => !c ? { t: "No card", cls: "bg-slate-50 text-slate-600 border-slate-200" }
    : c.status === "revoked" ? { t: "Revoked", cls: "bg-red-50 text-red-700 border-red-200" }
    : c.status === "expired" || new Date(c.expiresAt) < new Date() ? { t: "Expired", cls: "bg-amber-50 text-amber-800 border-amber-200" }
    : { t: "Active", cls: "bg-leaf-50 text-leaf-800 border-leaf-200" };
  return (
    <div>
      <p className="text-sm text-secondary font-body mb-4">Approved incubatees and mentors can hold a card. Cards are emailed as PDF, downloadable from each member’s profile, and checkable at /verify. The card text and validity come from <strong>Website content → ID card template</strong>.</p>
      {msg && <p role="status" className={`mb-4 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
      <div className="bg-white border border-border rounded-2xl shadow-card overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-2 text-left text-[11px] font-mono text-muted uppercase"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Card</th><th className="px-4 py-3">Valid till</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No eligible members yet.</td></tr>}
            {rows.map((r) => {
              const s = state(r.card);
              return (
                <tr key={r.userId} className="border-t border-border align-top">
                  <td className="px-4 py-3"><span className="font-semibold text-navy">{r.name}</span>{r.organisation && <span className="block text-xs text-muted">{r.organisation}</span>}{r.ineligible && <span className="block text-[11px] text-red-700">No longer eligible</span>}</td>
                  <td className="px-4 py-3 text-secondary">{r.roleLabel}</td>
                  <td className="px-4 py-3"><span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${s.cls}`}>{s.t}</span>{r.card && <span className="block text-xs font-mono text-muted mt-1">{r.card.number}</span>}</td>
                  <td className="px-4 py-3 text-secondary">{r.card ? date(r.card.expiresAt) : "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                    {r.card && <a href={`/api/idcards/pdf?userId=${r.userId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:underline">View PDF</a>}
                    {r.card && <a href={`/verify/${r.card.number}`} target="_blank" rel="noopener noreferrer" className="text-xs text-secondary hover:underline">Verify page</a>}
                    {canIssue && !r.ineligible && <button disabled={busy === r.userId} onClick={() => act(r, "POST")} className="text-xs font-semibold text-brand hover:underline disabled:opacity-50">{r.card ? "Renew & email" : "Issue & email"}</button>}
                    {canIssue && r.card && r.card.status === "active" && <button disabled={busy === r.userId} onClick={() => act(r, "PATCH")} className="text-xs text-red-700 hover:underline">Revoke</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
