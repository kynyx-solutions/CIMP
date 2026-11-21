"use client";
// Partner integrations (BIIF 2.0): API keys for the read-only partner API, and signed webhooks.
import { useCallback, useEffect, useState } from "react";
import { API_SCOPES, WEBHOOK_EVENTS } from "@/lib/crm";

type Key = { _id: string; name: string; prefix: string; scopes: string[]; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
type Hook = { _id: string; url: string; events: string[]; active: boolean; secretHint: string; lastStatus: number | null; lastError: string | null; lastDeliveredAt: string | null;
  deliveries: { _id: string; event: string; status: number | null; error: string | null; durationMs: number | null; createdAt: string }[] };
const input = "w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm font-body";
const ts = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Integrations() {
  const [d, setD] = useState<{ keys: Key[]; webhooks: Hook[]; canEdit: boolean } | null>(null);
  const [kf, setKf] = useState({ name: "", scopes: ["startups:read"] as string[] });
  const [hf, setHf] = useState({ url: "", events: ["startup.published"] as string[] });
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const load = useCallback(() => fetch("/api/admin/integrations").then((r) => r.json()).then(setD), []);
  useEffect(() => { load(); }, [load]);
  async function call(method: string, body: object | null, url = "/api/admin/integrations") {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const x = await res.json();
    if (!res.ok) { setMsg({ text: x.error, ok: false }); return null; }
    await load(); return x;
  }
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  if (!d) return <p className="text-sm text-muted font-body">Loading…</p>;
  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
      {secret && (
        <div role="alert" className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-sm font-body text-amber-900">
          <p className="font-semibold">{secret.label}: copy it now. It will not be shown again.</p>
          <code className="mt-2 block bg-white border border-amber-200 rounded-lg px-3 py-2 font-mono text-xs break-all select-all">{secret.value}</code>
          <button onClick={() => setSecret(null)} className="mt-2 text-xs font-semibold underline">I have saved it</button>
        </div>
      )}

      <section className="bg-white border border-border rounded-2xl shadow-card p-6">
        <h3 className="font-body font-bold text-navy">Partner API keys</h3>
        <p className="text-sm text-secondary font-body mt-1">Partners (e.g. Startup Bihar, a CSR funder) read published startups and programme statistics. Read-only, public fields only, 60 requests a minute per key.</p>
        <pre className="mt-3 bg-surface-2 border border-border rounded-lg p-3 text-xs font-mono overflow-x-auto">GET {base}/api/v1/startups?sector=AgriTech{"\n"}GET {base}/api/v1/stats{"\n"}Authorization: Bearer cbk_…</pre>
        <ul className="mt-4 divide-y divide-border">
          {d.keys.length === 0 && <li className="py-3 text-sm text-muted font-body">No keys yet.</li>}
          {d.keys.map((k) => (
            <li key={k._id} className="py-3 flex flex-wrap items-center gap-3 text-sm font-body">
              <span className="font-semibold text-navy">{k.name}</span>
              <code className="font-mono text-xs text-muted">{k.prefix}…</code>
              <span className="text-xs text-secondary">{k.scopes.join(", ")}</span>
              <span className="text-xs text-muted">{k.revokedAt ? `Revoked ${ts(k.revokedAt)}` : k.lastUsedAt ? `Last used ${ts(k.lastUsedAt)}` : "Never used"}</span>
              {d.canEdit && !k.revokedAt && <button onClick={async () => { if (window.confirm(`Revoke "${k.name}"? Calls with it stop working at once.`) && await call("PATCH", { kind: "api_key", id: k._id, action: "revoke" })) setMsg({ text: "Key revoked.", ok: true }); }} className="ml-auto text-xs text-red-700 hover:underline">Revoke</button>}
            </li>
          ))}
        </ul>
        {d.canEdit && (
          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); const x = await call("POST", { kind: "api_key", ...kf }); if (x) { setSecret({ label: `API key for ${kf.name}`, value: x.key }); setKf({ name: "", scopes: ["startups:read"] }); } }}>
            <label className="block flex-1 min-w-[200px]"><span className="block text-xs text-muted font-body mb-1">Partner / key name</span><input required value={kf.name} onChange={(e) => setKf((f) => ({ ...f, name: e.target.value }))} className={input} /></label>
            <fieldset className="flex gap-3 text-sm font-body"><legend className="sr-only">Scopes</legend>{API_SCOPES.map((s) => <label key={s.value} className="flex items-center gap-1.5"><input type="checkbox" checked={kf.scopes.includes(s.value)} onChange={() => setKf((f) => ({ ...f, scopes: toggle(f.scopes, s.value) }))} className="accent-[#3F7A16]" />{s.label}</label>)}</fieldset>
            <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold font-body">Create key</button>
          </form>
        )}
      </section>

      <section className="bg-white border border-border rounded-2xl shadow-card p-6">
        <h3 className="font-body font-bold text-navy">Webhooks</h3>
        <p className="text-sm text-secondary font-body mt-1">The portal POSTs a JSON event to a partner&apos;s HTTPS endpoint, signed with <code className="font-mono text-xs">X-CIMP-Signature: sha256=HMAC(secret, body)</code>. Private and local network addresses are refused.</p>
        <ul className="mt-4 space-y-3">
          {d.webhooks.length === 0 && <li className="text-sm text-muted font-body">No webhooks yet.</li>}
          {d.webhooks.map((h) => (
            <li key={h._id} className="border border-border rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm font-body">
                <code className="font-mono text-xs text-navy break-all">{h.url}</code>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${h.active ? "bg-leaf-50 text-leaf-800 border-leaf-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{h.active ? "Active" : "Paused"}</span>
                {h.lastDeliveredAt && <span className={`text-xs ${h.lastError ? "text-red-700" : "text-leaf-800"}`}>Last: {h.lastError ?? `HTTP ${h.lastStatus}`} · {ts(h.lastDeliveredAt)}</span>}
                {d.canEdit && (
                  <span className="ml-auto flex gap-3 text-xs">
                    <button onClick={async () => { const x = await call("PATCH", { kind: "webhook", id: h._id, action: "test" }); if (x) setMsg({ text: x.error ? `Test failed: ${x.error}` : `Test delivered: HTTP ${x.status} in ${x.durationMs} ms`, ok: !x.error }); }} className="text-brand font-semibold">Send test</button>
                    <button onClick={() => call("PATCH", { kind: "webhook", id: h._id, action: "toggle" })} className="text-secondary">{h.active ? "Pause" : "Resume"}</button>
                    <button onClick={async () => { if (window.confirm("Delete this webhook?")) await call("DELETE", null, `/api/admin/integrations?webhookId=${h._id}`); }} className="text-red-700">Delete</button>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted font-body mt-1">Events: {h.events.join(", ")} · secret {h.secretHint}</p>
              {h.deliveries.length > 0 && <ul className="mt-2 text-[11px] font-mono text-muted space-y-0.5">{h.deliveries.map((x) => <li key={x._id}>{ts(x.createdAt)} · {x.event} · {x.error ?? `HTTP ${x.status}`}{x.durationMs != null ? ` · ${x.durationMs} ms` : ""}</li>)}</ul>}
            </li>
          ))}
        </ul>
        {d.canEdit && (
          <form className="mt-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); const x = await call("POST", { kind: "webhook", ...hf }); if (x) { setSecret({ label: "Webhook signing secret", value: x.secret }); setHf({ url: "", events: ["startup.published"] }); } }}>
            <label className="block"><span className="block text-xs text-muted font-body mb-1">Endpoint URL</span><input required type="url" value={hf.url} onChange={(e) => setHf((f) => ({ ...f, url: e.target.value }))} placeholder="https://partner.example.com/cimp-webhook" className={input} /></label>
            <fieldset className="flex flex-wrap gap-4 text-sm font-body"><legend className="sr-only">Events</legend>{WEBHOOK_EVENTS.map((ev) => <label key={ev.value} className="flex items-center gap-1.5"><input type="checkbox" checked={hf.events.includes(ev.value)} onChange={() => setHf((f) => ({ ...f, events: toggle(f.events, ev.value) }))} className="accent-[#3F7A16]" />{ev.label}</label>)}</fieldset>
            <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold font-body">Add webhook</button>
          </form>
        )}
      </section>
    </div>
  );
}
