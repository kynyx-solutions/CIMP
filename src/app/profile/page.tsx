"use client";
// Your profile: account details and role-specific shortcuts.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import StageBadge from "@/components/StageBadge";
import { ROLE_LABELS, ROLE_ICONS } from "@/lib/workflow";
import { PROFILE_STATUS_LABELS } from "@/lib/network";

type Account = {
  id: string; name: string; email: string; role: string; image: string | null; createdAt: string; consentAt: string | null;
  hasPassword: boolean; isStaff: boolean;
  application: { id: string; startupName: string; stage: string; status: string; isPublic: boolean } | null;
  mentorProfile: { id: string; status: string; investorStatus: string; isPublic: boolean } | null;
};

const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.push("/login"); return; }
      setUser(d.user);
    });
    fetch("/api/account").then((r) => r.json()).then((d) => { if (d.account) { setAccount(d.account); setName(d.account.name); } });
  }, [router]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setAccount((a) => (a ? { ...a, name: d.name } : a));
    setUser((u: any) => ({ ...u, name: d.name }));
    setEditing(false); setMsg({ text: "Name updated.", ok: true });
  }

  if (!user || !account) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  const roleLabel = ROLE_LABELS[account.role as keyof typeof ROLE_LABELS] ?? account.role;
  const investor = account.mentorProfile?.investorStatus === "approved";
  const rows = [
    { k: "Email", v: account.email, note: account.isStaff ? "Company email; managed by the CEO" : "Used to sign in and for notifications" },
    { k: "Role", v: `${roleLabel}${investor ? " & Investor" : ""}` },
    { k: "Sign-in method", v: account.hasPassword ? "Email and password" : "Google" },
    { k: "Member since", v: fmt(account.createdAt) },
    ...(account.consentAt ? [{ k: "Terms & privacy accepted", v: fmt(account.consentAt) }] : []),
  ];

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Your profile</h1>
        <p className="text-secondary font-body text-sm mt-1">Your account on the CIMP-BIIF portal.</p>

        {msg && <p role="status" className={`mt-5 text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}

        <section className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {account.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.image} alt="" referrerPolicy="no-referrer" className="w-20 h-20 rounded-full object-cover border-2 border-leaf-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-leaf-50 border-2 border-leaf-200 flex items-center justify-center font-display text-3xl font-bold text-brand" aria-hidden="true">
                {account.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {editing ? (
                <form onSubmit={saveName} className="flex flex-wrap items-center gap-2">
                  <label htmlFor="name" className="sr-only">Full name</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required autoFocus
                    className="flex-1 min-w-[200px] bg-bg border border-border rounded-xl px-4 py-2.5 text-navy font-body focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100" />
                  <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={() => { setEditing(false); setName(account.name); }} className="px-4 py-2.5 rounded-xl border border-border text-sm font-body text-secondary">Cancel</button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-2xl font-bold text-navy break-words">{account.name}</h2>
                  <button onClick={() => setEditing(true)} className="text-sm font-body font-semibold text-brand hover:underline">Edit name</button>
                </div>
              )}
              <p className="text-sm text-muted font-body mt-1">
                <span aria-hidden="true">{ROLE_ICONS[account.role as keyof typeof ROLE_ICONS]}</span> {roleLabel}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-4 pt-6 border-t border-border">
            {rows.map((r) => (
              <div key={r.k}>
                <dt className="text-[11px] font-mono text-muted uppercase tracking-wider">{r.k}</dt>
                <dd className="font-body text-navy font-semibold mt-0.5 break-words">{r.v}</dd>
                {r.note && <dd className="text-xs text-muted font-body">{r.note}</dd>}
              </div>
            ))}
          </dl>
        </section>

        {/* Role-specific summary */}
        {account.role === "incubatee" && (
          <section className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6">
            <h2 className="font-body font-bold text-navy">Your startup</h2>
            {account.application ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="font-body text-navy font-semibold">{account.application.startupName}</p>
                <StageBadge stage={account.application.stage} />
                {account.application.isPublic && (
                  <Link href={`/startups/${account.application.id}`} className="text-sm font-body text-brand hover:underline">Public profile ↗</Link>
                )}
                <Link href="/apply" className="ml-auto text-sm font-body font-semibold text-brand hover:underline">View application →</Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-secondary font-body">You have not applied yet. <Link href="/apply" className="text-brand font-semibold underline">Start your application</Link></p>
            )}
          </section>
        )}
        {account.role === "mentor" && (
          <section className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6">
            <h2 className="font-body font-bold text-navy">Mentor profile</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-body">
              <span>Mentor: <strong className="text-navy">{PROFILE_STATUS_LABELS[account.mentorProfile?.status ?? "draft"]}</strong></span>
              <span>Investor: <strong className="text-navy">{PROFILE_STATUS_LABELS[account.mentorProfile?.investorStatus ?? "none"]}</strong></span>
              {account.mentorProfile?.status === "approved" && account.mentorProfile.isPublic && (
                <Link href={`/mentors/${account.mentorProfile.id}`} className="text-brand hover:underline">Public profile ↗</Link>
              )}
              <Link href="/mentor" className="ml-auto font-semibold text-brand hover:underline">Open Mentor hub →</Link>
            </div>
          </section>
        )}
        {account.isStaff && (
          <section className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6">
            <h2 className="font-body font-bold text-navy">Office account</h2>
            <p className="mt-2 text-sm text-secondary font-body">Your role and email are set by the CEO. Ask the CEO if either needs to change.</p>
          </section>
        )}

        <p className="mt-6 text-sm font-body text-muted">Password and privacy: <Link href="/settings" className="text-brand font-semibold hover:underline">Settings →</Link></p>
      </div>
    </div>
  );
}
