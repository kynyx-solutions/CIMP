"use client";
import { useState } from "react";
import Link from "next/link";
import AuthShell, { inputCls, primaryBtn } from "@/components/public/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await res.json();
      setMsg(res.ok ? { text: d.message, ok: true } : { text: d.error || "Something went wrong", ok: false });
    } catch {
      setMsg({ text: "Something went wrong. Please try again.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Forgot your password?" subtitle={<>Remembered it? <Link href="/login" className="text-brand font-semibold hover:text-navy">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm text-secondary font-body">Enter the email you sign in with. We will send a link to choose a new password.</p>
        <div>
          <label htmlFor="email" className="block text-sm font-body font-medium text-navy mb-1.5">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
        </div>
        {msg && <p role="status" className={`text-sm font-body ${msg.ok ? "text-brand" : "text-red-700"}`}>{msg.text}</p>}
        <button type="submit" disabled={busy || msg?.ok} className={primaryBtn}>{busy ? "Sending…" : "Send reset link"}</button>
      </form>
    </AuthShell>
  );
}
