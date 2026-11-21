"use client";
// Blog workspace (PRD BLG-1): Office Staff write and submit; Admin IT reviews and publishes.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { AiDraft } from "@/components/AiTools";
import { BLOG_STATUS, BLOG_WRITERS, parseBody } from "@/lib/blog";

type Post = { _id: string; slug: string; title: string; excerpt: string; body: string; status: string; authorId: string; authorName: string; reviewNote: string | null; updatedAt: string; publishedAt: string | null };
const TONE = { muted: "bg-slate-50 text-slate-600 border-slate-200", warn: "bg-amber-50 text-amber-800 border-amber-200", good: "bg-leaf-50 text-leaf-800 border-leaf-200", bad: "bg-red-50 text-red-700 border-red-200" };
const input = "w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm font-body text-navy focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";
const EMPTY = { title: "", excerpt: "", body: "" };

export default function PostsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [edit, setEdit] = useState<{ id: string | null; f: typeof EMPTY } | null>(null);
  const [preview, setPreview] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user || !BLOG_WRITERS.includes(d.user.role)) { router.push("/dashboard"); return; }
      setUser(d.user);
    });
  }, [router]);
  const load = useCallback(async () => { const d = await fetch("/api/posts").then((r) => r.json()); setPosts(d.posts ?? []); setCanPublish(!!d.canPublish); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 5000); };
  async function save(submit: boolean) {
    if (!edit) return;
    setBusy(true);
    const res = await fetch("/api/posts", { method: edit.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: edit.id, ...edit.f, submit }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash(submit ? "Sent to Admin IT for approval." : "Draft saved."); setEdit(null); load();
  }
  async function review(p: Post, action: "publish" | "reject" | "unpublish") {
    let note = "";
    if (action === "reject") { note = window.prompt("What should the author change?")?.trim() ?? ""; if (!note) return; }
    if (action === "unpublish" && !window.confirm(`Unpublish "${p.title}"?`)) return;
    setBusy(true);
    const res = await fetch("/api/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: p._id, action, note }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) return flash(d.error, false);
    flash(action === "publish" ? "Published on the public blog." : action === "reject" ? "Sent back to the author." : "Unpublished."); setPreview(null); load();
  }

  if (!user || !posts) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  const queue = posts.filter((p) => p.status === "submitted");
  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      {msg && <div role="status" className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl border text-sm font-body shadow-card-lg ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-navy">Blog posts</h1>
          <Link href="/blog" target="_blank" className="text-sm font-body text-brand hover:underline">Public blog ↗</Link>
          {!edit && <button onClick={() => { setEdit({ id: null, f: EMPTY }); setPreview(null); }} className="ml-auto px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body">+ New post</button>}
        </div>
        <p className="text-secondary font-body text-sm mt-1">{canPublish ? "Review posts from the office team and publish them to the public site." : "Write news, event reports and founder stories. Admin IT approves each post before it goes live."}</p>

        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); save(true); }} className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6 space-y-4">
            <AiDraft kind="blog" onDraft={(r) => setEdit((x) => x && { ...x, f: { title: (r.title ?? x.f.title).slice(0, 140), excerpt: (r.excerpt ?? x.f.excerpt).slice(0, 300), body: r.text } })} />
            <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Title</span>
              <input required maxLength={140} value={edit.f.title} onChange={(e) => setEdit((x) => x && { ...x, f: { ...x.f, title: e.target.value } })} className={input} /></label>
            <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Summary</span>
              <input required maxLength={300} value={edit.f.excerpt} onChange={(e) => setEdit((x) => x && { ...x, f: { ...x.f, excerpt: e.target.value } })} placeholder="One or two sentences shown on the blog list" className={input} /></label>
            <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Post</span>
              <textarea required rows={14} maxLength={20000} value={edit.f.body} onChange={(e) => setEdit((x) => x && { ...x, f: { ...x.f, body: e.target.value } })} className={`${input} font-mono text-[13px] resize-y`} />
              <span className="block text-xs text-muted font-body mt-1">Blank line = new paragraph. A line starting with &quot;## &quot; is a heading; lines starting with &quot;- &quot; make a list.</span></label>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setEdit(null)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-body">Cancel</button>
              <button type="button" onClick={() => save(false)} disabled={busy} className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold font-body text-navy disabled:opacity-50">Save draft</button>
              <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Submit for approval</button>
            </div>
          </form>
        )}

        {canPublish && queue.length > 0 && <p className="mt-6 text-sm font-body font-semibold text-amber-800">{queue.length} post{queue.length > 1 ? "s" : ""} waiting for your approval</p>}
        <div className="mt-4 grid lg:grid-cols-[1fr_1fr] gap-6 items-start">
          <ul className="bg-white border border-border rounded-2xl shadow-card divide-y divide-border">
            {posts.length === 0 && <li className="p-8 text-center text-muted font-body text-sm">No posts yet.</li>}
            {posts.map((p) => {
              const s = BLOG_STATUS[p.status];
              const mine = p.authorId === user.userId;
              return (
                <li key={p._id} className={`px-4 py-3 ${preview?._id === p._id ? "bg-leaf-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPreview(p)} className="text-left text-sm font-body font-semibold text-navy hover:text-brand flex-1 min-w-0 truncate">{p.title}</button>
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${TONE[s?.tone ?? "muted"]}`}>{s?.label ?? p.status}</span>
                  </div>
                  <p className="text-[11px] font-mono text-muted">{p.authorName} · updated {new Date(p.updatedAt).toLocaleDateString("en-IN")}</p>
                  {p.reviewNote && p.status !== "published" && <p className="text-xs font-body text-red-700 mt-1">Admin IT: {p.reviewNote}</p>}
                  {mine && ["draft", "rejected"].includes(p.status) && (
                    <button onClick={() => { setEdit({ id: p._id, f: { title: p.title, excerpt: p.excerpt, body: p.body } }); setPreview(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-1 text-xs font-body font-semibold text-brand hover:underline">Edit</button>
                  )}
                </li>
              );
            })}
          </ul>
          {preview && (
            <article className="bg-white border border-border rounded-2xl shadow-card p-6">
              <p className="text-[11px] font-mono text-muted">Preview · {preview.authorName}</p>
              <h2 className="font-display text-2xl font-bold text-navy mt-1">{preview.title}</h2>
              <p className="text-secondary font-body mt-2">{preview.excerpt}</p>
              <div className="mt-4 space-y-3 font-body text-sm text-navy leading-relaxed">
                {parseBody(preview.body).map((b, i) => b.kind === "h" ? <h3 key={i} className="font-bold text-base mt-4">{b.text}</h3> : b.kind === "ul" ? <ul key={i} className="list-disc pl-5 space-y-1">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul> : <p key={i}>{b.text}</p>)}
              </div>
              {canPublish && (
                <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-3">
                  {(preview.status === "submitted" || (preview.status === "draft" && preview.authorId === user.userId)) && <button disabled={busy} onClick={() => review(preview, "publish")} className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">Publish</button>}
                  {preview.status === "submitted" && <button disabled={busy} onClick={() => review(preview, "reject")} className="px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold font-body">Send back</button>}
                  {preview.status === "published" && <><Link href={`/blog/${preview.slug}`} target="_blank" className="px-4 py-2 rounded-xl border border-border text-sm font-body">View live ↗</Link><button disabled={busy} onClick={() => review(preview, "unpublish")} className="px-4 py-2 rounded-xl border border-border text-sm font-body text-secondary">Unpublish</button></>}
                </div>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
