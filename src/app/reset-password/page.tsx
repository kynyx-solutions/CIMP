"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell, { inputCls, primaryBtn } from "@/components/public/AuthShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<{ checking: boolean; email?: string; min: number; error?: string }>({ checking: true, min: 6 });
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setState(d.valid ? { checking: false, email: d.email, min: d.minLength } : { checking: false, min: 6, error: d.error }))
      .catch(() => setState({ checking: false, min: 6, error: "Something went wrong. Please try again." }));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.password !== pw.confirm) { setMsg("The passwords do not match"); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw.password }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || "Something went wrong"); return; }
    router.push("/login?reset=1");
  }

  return (
    <AuthShell title="Choose a new password" subtitle={<><Link href="/login" className="text-brand font-semibold hover:text-navy">Back to sign in</Link></>}>
      {state.checking ? (
        <p className="text-sm text-secondary font-body">Checking your link…</p>
      ) : state.error ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-red-700 font-body">{state.error}</p>
          <Link href="/forgot-password" className={`${primaryBtn} inline-block text-center`}>Get a new link</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <p className="text-sm text-secondary font-body">For <strong className="text-navy">{state.email}</strong>. Every device signed in to this account will be signed out.</p>
          <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">New password</span>
            <input type="password" required autoComplete="new-password" minLength={state.min} maxLength={128} value={pw.password}
              onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))} className={inputCls} />
            <span className="block text-xs text-muted font-body mt-1.5">At least {state.min} characters.</span></label>
          <label className="block"><span className="block text-sm font-body font-medium text-navy mb-1.5">Confirm new password</span>
            <input type="password" required autoComplete="new-password" minLength={state.min} maxLength={128} value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} className={inputCls} /></label>
          {msg && <p role="alert" className="text-sm text-red-700 font-body">{msg}</p>}
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
