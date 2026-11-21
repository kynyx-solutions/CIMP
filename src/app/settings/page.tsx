"use client";
// Settings: password and privacy.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";

type Account = { email: string; role: string; hasPassword: boolean; isStaff: boolean; consentAt: string | null };

const inputCls = "w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-navy font-body text-sm focus:outline-none focus:border-brand-2 focus:ring-2 focus:ring-leaf-100";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.push("/login"); return; }
      setUser(d.user);
    });
    fetch("/api/account").then((r) => r.json()).then((d) => setAccount(d.account ?? null));
  }, [router]);

  const min = account?.isStaff ? 8 : 6;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw.newPassword !== pw.confirm) { setMsg({ text: "The new passwords do not match", ok: false }); return; }
    setBusy(true);
    const res = await fetch("/api/account", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    });
    const d = await res.json(); setBusy(false);
    if (!res.ok) { setMsg({ text: d.error, ok: false }); return; }
    setPw({ currentPassword: "", newPassword: "", confirm: "" });
    setMsg({ text: "Password changed. Use the new password next time you sign in.", ok: true });
  }

  if (!user || !account) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-bg">
      <Navbar user={user} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-navy">Settings</h1>
        <p className="text-secondary font-body text-sm mt-1">Signed in as {account.email}. <Link href="/profile" className="text-brand font-semibold hover:underline">Your profile</Link></p>

        <section aria-labelledby="pw-title" className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6">
          <h2 id="pw-title" className="font-body font-bold text-navy">Password</h2>
          {account.hasPassword ? (
            <form onSubmit={changePassword} className="mt-4 space-y-4 max-w-md">
              {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-body px-4 py-2.5 rounded-xl border ${msg.ok ? "bg-leaf-50 border-leaf-200 text-leaf-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</p>}
              <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Current password</span>
                <input type="password" autoComplete="current-password" required value={pw.currentPassword}
                  onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} className={inputCls} /></label>
              <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">New password</span>
                <input type="password" autoComplete="new-password" required minLength={min} maxLength={128} value={pw.newPassword}
                  onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} className={inputCls} aria-describedby="pw-help" />
                <span id="pw-help" className="block text-xs text-muted font-body mt-1">At least {min} characters{account.isStaff ? " (office accounts)" : ""}.</span></label>
              <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Confirm new password</span>
                <input type="password" autoComplete="new-password" required minLength={min} maxLength={128} value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className={inputCls} /></label>
              <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold font-body disabled:opacity-50">
                {busy ? "Changing…" : "Change password"}
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-secondary font-body">You sign in with Google, so your password is managed in your Google account.</p>
          )}
        </section>

        <section aria-labelledby="privacy-title" className="mt-6 bg-white border border-border rounded-2xl shadow-card p-6">
          <h2 id="privacy-title" className="font-body font-bold text-navy">Privacy</h2>
          <ul className="mt-3 space-y-2 text-sm font-body text-secondary">
            {account.consentAt && <li>You accepted the Terms of Use and Privacy Policy on {new Date(account.consentAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.</li>}
            <li>Your documents are visible only to you and the CIMP-BIIF review team. Only fields marked public appear on public pages, and only after approval.</li>
            <li>To correct, export or delete your data, message the office from <Link href="/messages" className="text-brand font-semibold hover:underline">Messages</Link> or write to startup@cimp.ac.in.</li>
          </ul>
          <p className="mt-4 text-sm font-body">
            <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link> · <Link href="/terms" className="text-brand hover:underline">Terms of Use</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
