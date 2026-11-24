"use client";
// Social media manager dashboard (BIIF 2.0): content calendar across platforms.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { AiDraft } from "@/components/AiTools";
import { PLATFORMS, SOCIAL_ROLES } from "@/lib/hr";
import Toast, { useFlash } from "@/components/Toast";

type Post = { _id: string; platforms: string[]; content: string; scheduledFor: string | null; status: string; publishedLinks: Record<string, string> | null; createdBy: string; updatedAt: string };
const input = "w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";
const when = (d: string) => new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const plat = (v: string) => PLATFORMS.find((p) => p.value === v)?.label ?? v;
const EMPTY = { platforms: ["linkedin"] as string[], content: "", scheduledFor: "" };

export default function SocialPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [d, setD] = useState<{ posts: Post[]; canEdit: boolean; stats: Record<string, number> } | null>(null);
  const [f, setF] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [busy, setBusy] = useState(false);
  const { msg, flash } = useFlash(4000);
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((x) => { if (!x.user || !SOCIAL_ROLES.includes(x.user.role)) { router.push("/dashboard"); return; } setUser(x.user); }); }, [router]);
  const load = useCallback(async () => setD(await fetch("/api/social").then((r) => r.json())), []);
  useEffect(() => { if (user) load(); }, [user, load]);
  async function call(method: string, body: object, ok: string) {
    setBusy(true);
    const res = await fetch("/api/social", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const x = await res.json(); setBusy(false);
    if (!res.ok) { flash(x.error, false); return false; }
    flash(ok); await load(); return true;
  }
  if (!user || !d) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  const upcoming = d.posts.filter((p) => p.status === "scheduled");
  const drafts = d.posts.filter((p) => p.status === "draft");
  const published = d.posts.filter((p) => p.status === "published").reverse();
  const xOver = f.platforms.includes("x") && f.content.length > 280;

  const Card = ({ p }: { p: Post }) => (
    <li className="bg-white border border-border rounded-2xl p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        {p.platforms.map((pl) => <span key={pl} className="text-[11px] font-mono px-2 py-0.5 rounded-full border bg-surface-2 border-border text-secondary">{plat(pl)}</span>)}
        {p.scheduledFor && <span className={`text-xs font-mono ${p.status === "scheduled" && new Date(p.scheduledFor) < new Date() ? "text-amber-800" : "text-muted"}`}>{when(p.scheduledFor)}</span>}
        <span className="ml-auto text-[11px] text-muted font-body">{p.createdBy}</span>
      </div>
      <p className="mt-2 text-sm font-body text-navy whitespace-pre-line">{p.content}</p>
      {p.publishedLinks && Object.entries(p.publishedLinks).map(([k, v]) => <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="block text-xs text-brand underline mt-1 break-all">{plat(k)} ↗</a>)}
      {d.canEdit && p.status !== "published" && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-body">
          <button onClick={() => { const links: Record<string, string> = {}; for (const pl of p.platforms) { const v = window.prompt(`Link to the published ${plat(pl)} post (optional):`)?.trim(); if (v) links[pl] = v; } call("PATCH", { id: p._id, action: "publish", links }, "Marked as published."); }} className="font-semibold text-brand">Mark published</button>
          <button onClick={() => { setF({ id: p._id, platforms: p.platforms, content: p.content, scheduledFor: p.scheduledFor ? new Date(new Date(p.scheduledFor).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-secondary">Edit</button>
          {p.status === "scheduled" && <button onClick={() => call("PATCH", { id: p._id, action: "unschedule" }, "Moved to drafts.")} className="text-secondary">Unschedule</button>}
        </div>
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <Toast msg={msg} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Social media</h1>
        <p className="text-secondary font-body text-sm mt-1">Plan CIMP-BIIF&apos;s posts across platforms. Posting happens on each platform; record the link here to keep the history.</p>
        <ul className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLATFORMS.map((p) => <li key={p.value} className="bg-white border border-border rounded-2xl p-4 shadow-card"><p className="text-[11px] font-mono text-muted uppercase">{p.label}</p><p className="font-display text-2xl font-bold text-navy tabular-nums">{d.stats[p.value] ?? 0}</p><p className="text-xs text-muted font-body">published this month</p></li>)}
        </ul>
        <div className="mt-6 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-6">
            <section><h2 className="font-body font-bold text-navy text-sm mb-2">Scheduled ({upcoming.length})</h2>{upcoming.length ? <ul className="space-y-3">{upcoming.map((p) => <Card key={p._id} p={p} />)}</ul> : <p className="text-sm text-muted font-body">Nothing scheduled.</p>}</section>
            <section><h2 className="font-body font-bold text-navy text-sm mb-2">Drafts ({drafts.length})</h2>{drafts.length ? <ul className="space-y-3">{drafts.map((p) => <Card key={p._id} p={p} />)}</ul> : <p className="text-sm text-muted font-body">No drafts.</p>}</section>
            <section><h2 className="font-body font-bold text-navy text-sm mb-2">Published ({published.length})</h2>{published.length ? <ul className="space-y-3">{published.slice(0, 20).map((p) => <Card key={p._id} p={p} />)}</ul> : <p className="text-sm text-muted font-body">None yet.</p>}</section>
          </div>
          {d.canEdit && (
            <form className="bg-white border border-border rounded-2xl shadow-card p-5 space-y-3 lg:sticky lg:top-20"
              onSubmit={async (e) => { e.preventDefault(); const body = { ...f, scheduledFor: f.scheduledFor ? new Date(f.scheduledFor).toISOString() : null }; if (await call(f.id ? "PUT" : "POST", body, f.scheduledFor ? "Scheduled." : "Draft saved.")) setF(EMPTY); }}>
              <h2 className="font-body font-bold text-navy">{f.id ? "Edit post" : "New post"}</h2>
              <fieldset className="flex flex-wrap gap-3 text-sm font-body"><legend className="sr-only">Platforms</legend>
                {PLATFORMS.map((p) => <label key={p.value} className="flex items-center gap-1.5"><input type="checkbox" checked={f.platforms.includes(p.value)} onChange={() => setF((x) => ({ ...x, platforms: x.platforms.includes(p.value) ? x.platforms.filter((v) => v !== p.value) : [...x.platforms, p.value] }))} className="accent-[#3F7A16]" />{p.label}</label>)}
              </fieldset>
              <AiDraft kind="social" platform={f.platforms.includes("x") ? "x" : f.platforms[0]} onDraft={(r) => setF((x) => ({ ...x, content: r.text }))} />
              <textarea required rows={6} maxLength={3000} value={f.content} onChange={(e) => setF((x) => ({ ...x, content: e.target.value }))} placeholder="Write the post" aria-label="Post text" className={`${input} resize-y`} />
              <p className={`text-xs font-mono ${xOver ? "text-red-700" : "text-muted"}`}>{f.content.length} characters{f.platforms.includes("x") ? " · X limit 280" : ""}</p>
              <label className="block"><span className="block text-xs text-muted font-body mb-1">Schedule for (leave empty to keep as draft)</span><input type="datetime-local" value={f.scheduledFor} onChange={(e) => setF((x) => ({ ...x, scheduledFor: e.target.value }))} className={input} /></label>
              <div className="flex gap-2">{f.id && <button type="button" onClick={() => setF(EMPTY)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-body">Cancel</button>}<button type="submit" disabled={busy || xOver} className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">{f.scheduledFor ? "Schedule" : "Save draft"}</button></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
